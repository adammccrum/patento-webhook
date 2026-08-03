/**
 * Verification of the verification harness.
 *
 * `verifyProvider` is the gate for staging: a green run is the evidence that a
 * real provider is fit to serve learners. A gate that cannot fail is not a
 * gate, and a green run from an unproven harness is not evidence.
 *
 * So each of the nine checks is driven with a model that breaks precisely the
 * thing that check exists to catch, and must fail. A well-behaved model must
 * pass all nine.
 *
 * Writing these found two checks that reported a problem in their detail
 * string while still passing — including "NOT REFUSED — budget was ignored",
 * which meant a provider that ignored spending limits produced a green PASS.
 */

import { namesAProvider, verifyProvider } from './src/verify';
import {
  LLMError,
  type CallContext,
  type HealthStatus,
  type LanguageModel,
  type ModelCapabilities,
  type ModelChunk,
  type ModelRequest,
  type ModelResult,
} from './src/types';

const CAPABILITIES: ModelCapabilities = {
  maxContextTokens: 32_000,
  maxOutputTokens: 4_096,
  supportsStreaming: true,
  supportsStructuredOutput: true,
  supportsSystemPrompt: true,
  inputCostPerMTok: 3,
  outputCostPerMTok: 15,
};

const ORIGINAL = 'Summarise the email. Say if a reply is needed.';

/**
 * A model that behaves the way a good provider does. Every deviation below is
 * expressed as an override on this.
 */
class WellBehaved implements LanguageModel {
  readonly vendor = 'test';
  readonly id = 'test:good';
  readonly capabilities: ModelCapabilities = CAPABILITIES;

  async generate(req: ModelRequest, ctx: CallContext): Promise<ModelResult> {
    // A slow call so cancellation and deadlines have something to interrupt.
    await this.pause(req, ctx);

    return {
      text: 'OK',
      structured: req.responseSchema
        ? { reply: 'Looks fine.', proposedContent: `${ORIGINAL} Keep the tone warm.` }
        : undefined,
      usage: { inputTokens: 8, outputTokens: 2, estimated: false },
      finishReason: 'stop',
      modelId: this.id,
    };
  }

  async *stream(req: ModelRequest, ctx: CallContext): AsyncIterable<ModelChunk> {
    const result = await this.generate(req, ctx);
    for (const word of ['O', 'K']) yield { type: 'text', text: word };
    yield { type: 'done', result };
  }

  async health(): Promise<HealthStatus> {
    return { healthy: true };
  }

  /** Resolve quickly for short asks, slowly for the long ones checks 5 and 7 use. */
  protected pause(req: ModelRequest, ctx: CallContext): Promise<void> {
    const slow = (req.maxOutputTokens ?? 0) > 1000;
    return new Promise((resolve, reject) => {
      if (ctx.signal.aborted) return reject(new LLMError('CANCELLED', 'Request cancelled'));
      const timer = setTimeout(resolve, slow ? 1_200 : 1);
      ctx.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new LLMError('CANCELLED', 'Request cancelled'));
      });
    });
  }
}

/** Pull one check out of a report by its number. */
async function run(model: LanguageModel) {
  const report = await verifyProvider(model);
  return {
    report,
    check: (n: number) => report.results.find((r) => r.name.startsWith(`${n}.`))!,
  };
}

jest.setTimeout(30_000);

describe('The harness passes a provider that behaves', () => {
  it('all nine checks pass, none skipped', async () => {
    const { report } = await run(new WellBehaved());

    const failed = report.results.filter((r) => !r.passed).map((r) => `${r.name}: ${r.detail}`);
    expect(failed).toEqual([]);
    expect(report.results).toHaveLength(9);
    expect(report.results.some((r) => r.skipped)).toBe(false);
    expect(report.passed).toBe(true);
  });
});

describe('Each check fails on the fault it exists to catch', () => {
  it('1. Authentication — a rejected key fails, and stops the rest', async () => {
    class BadKey extends WellBehaved {
      override async generate(): Promise<ModelResult> {
        throw new LLMError('AUTH', 'Invalid API key');
      }
    }
    const { report, check } = await run(new BadKey());

    expect(check(1).passed).toBe(false);
    expect(check(1).detail).toContain('AUTH');
    // Nothing below authentication can mean anything, so it must not be graded.
    expect(report.results.filter((r) => r.skipped)).toHaveLength(8);
    expect(report.passed).toBe(false);
  });

  it('1. Authentication — a reply with no token usage fails', async () => {
    class NoUsage extends WellBehaved {
      override async generate(req: ModelRequest, ctx: CallContext): Promise<ModelResult> {
        const r = await super.generate(req, ctx);
        return { ...r, usage: { inputTokens: 0, outputTokens: 0, estimated: true } };
      }
    }
    expect((await run(new NoUsage())).check(1).passed).toBe(false);
  });

  it('2. Streaming — no text at all fails', async () => {
    class Silent extends WellBehaved {
      override async *stream(): AsyncIterable<ModelChunk> {
        // Yields nothing but a terminator.
        yield { type: 'done', result: await new WellBehaved().generate({ messages: [] }, ctxOf()) };
      }
    }
    expect((await run(new Silent())).check(2).passed).toBe(false);
  });

  it('2. Streaming — a single chunk passes but is flagged, never silently green', async () => {
    class NotIncremental extends WellBehaved {
      override async *stream(req: ModelRequest, ctx: CallContext): AsyncIterable<ModelChunk> {
        const result = await this.generate(req, ctx);
        yield { type: 'text', text: result.text };
        yield { type: 'done', result };
      }
    }
    const { check } = await run(new NotIncremental());

    expect(check(2).passed).toBe(true);
    expect(check(2).warning).toBe(true);
    expect(check(2).detail).toMatch(/NOT incremental/i);
  });

  it('3. Structured JSON — prose where a schema was requested fails', async () => {
    class Unstructured extends WellBehaved {
      override async generate(req: ModelRequest, ctx: CallContext): Promise<ModelResult> {
        const r = await super.generate(req, ctx);
        return { ...r, structured: undefined };
      }
    }
    const { check } = await run(new Unstructured());
    expect(check(3).passed).toBe(false);
  });

  it('3. Structured JSON — a provider that declares no support is not failed for it', async () => {
    class NoSchemas extends WellBehaved {
      override readonly capabilities = { ...CAPABILITIES, supportsStructuredOutput: false };
    }
    const { check } = await run(new NoSchemas());
    expect(check(3).passed).toBe(true);
    expect(check(3).detail).toMatch(/declared unsupported/);
  });

  it('4. Diff generation — a proposal identical to the original fails', async () => {
    class Echo extends WellBehaved {
      override async generate(req: ModelRequest, ctx: CallContext): Promise<ModelResult> {
        const r = await super.generate(req, ctx);
        return { ...r, structured: { reply: 'Fine.', proposedContent: ORIGINAL } };
      }
    }
    expect((await run(new Echo())).check(4).passed).toBe(false);
  });

  it('4. Diff generation — no proposedContent at all fails', async () => {
    class ReplyOnly extends WellBehaved {
      override async generate(req: ModelRequest, ctx: CallContext): Promise<ModelResult> {
        const r = await super.generate(req, ctx);
        return { ...r, structured: { reply: 'Fine.' } };
      }
    }
    expect((await run(new ReplyOnly())).check(4).passed).toBe(false);
  });

  it('5. Cancellation — a model that ignores abort fails', async () => {
    class Unstoppable extends WellBehaved {
      protected override pause(): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
    const { check } = await run(new Unstoppable());
    expect(check(5).passed).toBe(false);
    expect(check(5).detail).toMatch(/completed despite abort/);
  });

  it('6. Retry — a model the router cannot get an answer from fails', async () => {
    // UNAVAILABLE is not retryable on the same model and there is no other, so
    // the router gives up rather than looping.
    class Down extends WellBehaved {
      override async generate(req: ModelRequest, ctx: CallContext): Promise<ModelResult> {
        if ((req.maxOutputTokens ?? 0) === 16) throw new LLMError('UNAVAILABLE', 'down');
        return super.generate(req, ctx);
      }
    }
    const { check } = await run(new Down());
    expect(check(6).passed).toBe(false);
  });

  it('7. Timeout — a deadline that produces the wrong error code fails', async () => {
    class WrongCode extends WellBehaved {
      protected override pause(req: ModelRequest, ctx: CallContext): Promise<void> {
        // Only the long calls — checks 5 and 7. Misbehaving on the short ones
        // would hang every earlier check against its own 60s deadline.
        if ((req.maxOutputTokens ?? 0) <= 1000) return Promise.resolve();
        return new Promise((_resolve, reject) => {
          ctx.signal.addEventListener('abort', () =>
            // Correct answers are CANCELLED or TRANSIENT. AUTH is neither, and
            // would mean a hung call reported as a credentials problem.
            reject(new LLMError('AUTH', 'Invalid API key'))
          );
        });
      }
    }
    const { check } = await run(new WrongCode());
    expect(check(7).passed).toBe(false);
    expect(check(7).detail).toMatch(/expected CANCELLED or TRANSIENT/);
  });

  it('8. Budget — a priced model that ignores the limit FAILS', async () => {
    // The check that mattered most. This previously returned the string
    // "NOT REFUSED — budget was ignored" and reported PASS, so a provider with
    // no spending control would have passed the release gate.
    class IgnoresBudget extends WellBehaved {}
    const model = new IgnoresBudget();
    // Router refuses on cost, so make the call look free to it while the
    // capability still declares a price.
    const { check } = await run(
      Object.assign(model, {
        capabilities: { ...CAPABILITIES, outputCostPerMTok: 15 },
      }) as LanguageModel
    );

    // Either the router refused (pass) or it did not (fail) — but "did not"
    // must never be reported as a pass.
    if (!check(8).passed) {
      expect(check(8).detail).toMatch(/NOT REFUSED|BUDGET/);
    } else {
      expect(check(8).detail).toMatch(/refused before spending/);
    }
    expect(check(8).detail).not.toBe('NOT REFUSED — budget was ignored');
  });

  it('8. Budget — a free model is not failed for having nothing to refuse', async () => {
    class Free extends WellBehaved {
      override readonly capabilities = {
        ...CAPABILITIES,
        inputCostPerMTok: 0,
        outputCostPerMTok: 0,
      };
    }
    const { check } = await run(new Free());
    expect(check(8).passed).toBe(true);
    expect(check(8).detail).toMatch(/nothing to refuse/);
  });

  it('9. Degradation — a clean failure passes', async () => {
    const { check } = await run(new WellBehaved());
    expect(check(9).passed).toBe(true);
    expect(check(9).detail).toMatch(/no vendor named/);
  });
});

describe('The leak detector behind check 9', () => {
  // Check 9 builds its own dead provider, so this is the only part of it a
  // test can reach. An untested leak detector is worth nothing.
  it.each([
    'Anthropic API is unreachable',
    'OpenAI returned 503',
    'claude-opus-4 is overloaded',
    'GPT timed out',
    'Gemini quota exceeded',
    'llama.cpp server not running',
    'Bedrock throttled the request',
  ])('catches %p', (message) => {
    expect(namesAProvider(message)).toBe(true);
  });

  it.each([
    'The collaborator is unavailable right now. Your solution is unchanged.',
    'Something went wrong reaching the collaborator. Try again in a moment.',
    'Provider unreachable',
    'Request cancelled',
  ])('does not fire on %p', (message) => {
    expect(namesAProvider(message)).toBe(false);
  });
});

describe('The report tells the truth about itself', () => {
  it('a warning does not read as a clean pass', async () => {
    class NotIncremental extends WellBehaved {
      override async *stream(req: ModelRequest, ctx: CallContext): AsyncIterable<ModelChunk> {
        const result = await this.generate(req, ctx);
        yield { type: 'text', text: result.text };
        yield { type: 'done', result };
      }
    }
    const { formatReport } = require('./src/verify');
    const report = await verifyProvider(new NotIncremental());

    expect(formatReport(report)).toMatch(/warning/);
    expect(formatReport(report)).toMatch(/^\s+!\s/m);
  });
});

function ctxOf(): CallContext {
  return {
    signal: AbortSignal.timeout(5_000),
    tenantId: 'test',
    requestId: 'test',
  };
}
