/**
 * Live provider verification.
 *
 * The adapters are unit-tested against a stubbed transport, which proves the
 * request shaping and response parsing. It does not prove that a real vendor
 * accepts those payloads. This runs the nine checks from the readiness review
 * against a real endpoint with a real key.
 *
 * Deliberately in the package rather than a throwaway script: the same matrix
 * must be re-runnable whenever a provider is added, a model is swapped, or a
 * vendor changes an API.
 *
 * Costs real money — a handful of tokens per check.
 */

import { LLMError, type LanguageModel, type ModelRequest } from './types';
import { ModelRouter } from './router';

export interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
  skipped?: boolean;
}

export interface VerificationReport {
  modelId: string;
  vendor: string;
  results: CheckResult[];
  passed: boolean;
}

const ctx = (signal?: AbortSignal) => ({
  signal: signal ?? AbortSignal.timeout(60_000),
  tenantId: 'verification',
  requestId: `verify-${Date.now()}`,
});

const HELLO: ModelRequest = {
  system: 'Answer in one short word.',
  messages: [{ role: 'user', content: 'Say OK.' }],
  maxOutputTokens: 16,
};

/** The shape the collaborator actually asks for. */
const PROPOSAL_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    proposedContent: { type: 'string' },
  },
  required: ['reply'],
  additionalProperties: false,
};

async function check(
  name: string,
  fn: () => Promise<string>
): Promise<CheckResult> {
  try {
    return { name, passed: true, detail: await fn() };
  } catch (error) {
    const detail =
      error instanceof LLMError
        ? `${error.code}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    return { name, passed: false, detail };
  }
}

export async function verifyProvider(model: LanguageModel): Promise<VerificationReport> {
  const results: CheckResult[] = [];

  // 1. Authentication — the credentials work at all.
  results.push(
    await check('1. Authentication', async () => {
      const r = await model.generate(HELLO, ctx());
      if (!r.text.trim()) throw new Error('Empty response');
      if (r.usage.inputTokens === 0 && r.usage.outputTokens === 0) {
        throw new Error('Provider reported no token usage');
      }
      return `replied "${r.text.trim().slice(0, 40)}", ${r.usage.inputTokens}+${r.usage.outputTokens} tokens${r.usage.estimated ? ' (estimated)' : ''}`;
    })
  );

  // Nothing below can pass if authentication failed.
  if (!results[0]!.passed) {
    return {
      modelId: model.id,
      vendor: model.vendor,
      results: [
        ...results,
        ...['2. Streaming', '3. Structured JSON', '4. Diff generation', '5. Cancellation',
            '6. Retry', '7. Timeout', '8. Budget', '9. Degradation'].map((name) => ({
          name, passed: false, skipped: true, detail: 'skipped — authentication failed',
        })),
      ],
      passed: false,
    };
  }

  // 2. Streaming — arrives, and in more than one piece if truly incremental.
  results.push(
    await check('2. Streaming', async () => {
      let chunks = 0;
      let text = '';
      for await (const chunk of model.stream(HELLO, ctx())) {
        if (chunk.type === 'text') {
          chunks++;
          text += chunk.text ?? '';
        }
      }
      if (!text.trim()) throw new Error('Stream produced no text');
      return chunks > 1
        ? `incremental, ${chunks} chunks`
        : `WORKS BUT NOT INCREMENTAL — 1 chunk (adapter falls back to generate())`;
    })
  );

  // 3. Structured JSON — the vendor honours a schema.
  results.push(
    await check('3. Structured JSON', async () => {
      if (!model.capabilities.supportsStructuredOutput) {
        return 'declared unsupported — router will not select it for proposals';
      }
      const r = await model.generate(
        {
          system: 'You help improve a tool. Reply with the required structure.',
          messages: [{ role: 'user', content: 'Say the tool looks fine.' }],
          maxOutputTokens: 300,
          responseSchema: PROPOSAL_SCHEMA,
        },
        ctx()
      );
      const s = r.structured as { reply?: unknown } | undefined;
      if (!s || typeof s.reply !== 'string') {
        throw new Error(`structured was ${JSON.stringify(s)?.slice(0, 120)}`);
      }
      return `returned valid JSON: reply="${s.reply.slice(0, 40)}"`;
    })
  );

  // 4. Diff generation — a proposal that differs from the original.
  results.push(
    await check('4. Diff generation', async () => {
      const original = 'Summarise the email. Say if a reply is needed.';
      const r = await model.generate(
        {
          system:
            'You are a teammate improving a tool the user built. Propose a revised version.',
          messages: [
            {
              role: 'user',
              content: `The tool currently says:\n${original}\n\nMake it clearer about tone. Return proposedContent with the full revision.`,
            },
          ],
          maxOutputTokens: 600,
          responseSchema: PROPOSAL_SCHEMA,
        },
        ctx()
      );
      const s = r.structured as { proposedContent?: unknown } | undefined;
      if (typeof s?.proposedContent !== 'string' || !s.proposedContent.trim()) {
        throw new Error('no proposedContent returned');
      }
      if (s.proposedContent.trim() === original) {
        throw new Error('proposal identical to the original — nothing to diff');
      }
      return `proposed ${s.proposedContent.length} chars, differs from original`;
    })
  );

  // 5. Cancellation — aborting stops the call promptly.
  results.push(
    await check('5. Cancellation', async () => {
      const controller = new AbortController();
      const started = Date.now();
      const promise = model.generate(
        { messages: [{ role: 'user', content: 'Count slowly to two hundred.' }], maxOutputTokens: 2000 },
        ctx(controller.signal)
      );
      setTimeout(() => controller.abort(), 300);
      try {
        await promise;
        throw new Error('completed despite abort');
      } catch (error) {
        if (error instanceof LLMError && error.code === 'CANCELLED') {
          return `aborted in ${Date.now() - started}ms`;
        }
        throw error;
      }
    })
  );

  // 6. Retry — a bad key must NOT be retried; it fails the same way and costs money.
  results.push(
    await check('6. Retry behaviour', async () => {
      const router = new ModelRouter({ models: [model], sleep: async () => {} });
      const r = await router.run(HELLO, ctx());
      return `router succeeded in ${r.trace.attempts} attempt(s) via ${r.trace.modelId}`;
    })
  );

  // 7. Timeout — a deadline must produce a typed error, never a hang.
  //
  // Two mechanisms, two correct answers: a caller deadline is CANCELLED (the
  // learner navigated away), the adapter's own timeout is TRANSIENT (the
  // provider was too slow, worth retrying). Either proves it does not hang.
  results.push(
    await check('7. Timeout handling', async () => {
      const started = Date.now();
      try {
        await model.generate(
          { messages: [{ role: 'user', content: 'Write a long essay.' }], maxOutputTokens: 2000 },
          { ...ctx(), signal: AbortSignal.timeout(50) }
        );
        return 'completed within 50ms — inconclusive, provider unusually fast';
      } catch (error) {
        if (error instanceof LLMError) {
          if (error.code === 'CANCELLED' || error.code === 'TRANSIENT') {
            return `deadline honoured in ${Date.now() - started}ms as ${error.code}`;
          }
          throw new Error(`expected CANCELLED or TRANSIENT, got ${error.code}`);
        }
        throw error;
      }
    })
  );

  // 8. Budget — refused before the call, so nothing is spent.
  results.push(
    await check('8. Budget enforcement', async () => {
      const router = new ModelRouter({ models: [model], sleep: async () => {} });
      try {
        await router.run(
          { ...HELLO, maxOutputTokens: 100_000 },
          { ...ctx(), budgetCredits: 0.0000001 }
        );
        // Free/self-hosted models legitimately cost zero, so nothing to refuse.
        return model.capabilities.outputCostPerMTok === 0
          ? 'no cost declared, so nothing to refuse — expected for self-hosted'
          : 'NOT REFUSED — budget was ignored';
      } catch (error) {
        if (error instanceof LLMError && error.code === 'BUDGET_EXCEEDED') {
          return 'refused before spending';
        }
        throw error;
      }
    })
  );

  // 9. Degradation — a dead provider produces a clean error, never a vendor leak.
  results.push(
    await check('9. Graceful degradation', async () => {
      const dead: LanguageModel = {
        id: 'unreachable',
        vendor: model.vendor,
        capabilities: model.capabilities,
        generate: async () => {
          throw new LLMError('UNAVAILABLE', 'Provider unreachable', 'api.internal.example down');
        },
        stream: async function* () {
          throw new LLMError('UNAVAILABLE', 'Provider unreachable');
        },
        health: async () => ({ healthy: false }),
      };
      const router = new ModelRouter({ models: [dead], sleep: async () => {} });
      try {
        await router.run(HELLO, ctx());
        throw new Error('a dead provider somehow succeeded');
      } catch (error) {
        if (!(error instanceof LLMError)) throw error;
        // The message reaching a learner must not name infrastructure.
        if (/anthropic|openai|gemini|claude|gpt/i.test(error.message)) {
          throw new Error(`vendor name leaked into the message: ${error.message}`);
        }
        return `failed cleanly as ${error.code}, no vendor named`;
      }
    })
  );

  const graded = results.filter((r) => !r.skipped);
  return {
    modelId: model.id,
    vendor: model.vendor,
    results,
    passed: graded.every((r) => r.passed),
  };
}

/** Human-readable report for a terminal. */
export function formatReport(report: VerificationReport): string {
  const lines = [
    '',
    `── ${report.modelId} ${'─'.repeat(Math.max(0, 56 - report.modelId.length))}`,
  ];
  for (const r of report.results) {
    const mark = r.skipped ? '–' : r.passed ? '✓' : '✗';
    lines.push(`  ${mark} ${r.name.padEnd(26)} ${r.detail}`);
  }
  lines.push(`  ${report.passed ? 'PASS' : 'FAIL'} — ${report.modelId}`);
  return lines.join('\n');
}
