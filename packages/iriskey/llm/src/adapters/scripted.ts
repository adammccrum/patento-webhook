/**
 * A model that runs no model.
 *
 * Two uses, both legitimate:
 *
 *  - Tests drive the collaborator end to end without a network or an API key.
 *  - A deployment with no provider configured still returns something honest
 *    rather than a stack trace, and the workspace stays usable by hand.
 *
 * It is deliberately obvious that no model ran. It never pretends.
 */

import {
  LLMError,
  estimateTokens,
  type CallContext,
  type HealthStatus,
  type LanguageModel,
  type ModelCapabilities,
  type ModelChunk,
  type ModelRequest,
  type ModelResult,
} from '../types';

export interface ScriptedOptions {
  /** Fixed replies, consumed in order; the last one repeats. */
  replies?: string[];
  /** Returned as `structured` when a schema is requested. */
  structured?: unknown;
  /** Fail every call with this, to exercise fallback paths. */
  failWith?: LLMError;
  capabilities?: Partial<ModelCapabilities>;
  id?: string;
}

const DEFAULTS: ModelCapabilities = {
  maxContextTokens: 32_000,
  maxOutputTokens: 4_096,
  supportsStreaming: true,
  supportsStructuredOutput: true,
  supportsSystemPrompt: true,
  inputCostPerMTok: 0,
  outputCostPerMTok: 0,
};

export class ScriptedAdapter implements LanguageModel {
  readonly vendor = 'scripted';
  readonly id: string;
  readonly capabilities: ModelCapabilities;

  /** Every request seen, so tests can assert on what was actually sent. */
  readonly calls: ModelRequest[] = [];

  private index = 0;

  constructor(private readonly options: ScriptedOptions = {}) {
    this.id = options.id ?? 'scripted:local';
    this.capabilities = { ...DEFAULTS, ...options.capabilities };
  }

  async generate(req: ModelRequest, ctx: CallContext): Promise<ModelResult> {
    this.calls.push(req);

    if (ctx.signal.aborted) {
      throw new LLMError('CANCELLED', 'Request cancelled');
    }
    if (this.options.failWith) {
      throw this.options.failWith;
    }

    const replies = this.options.replies ?? [
      'No language model is configured, so I cannot suggest an improvement yet. Your solution is unchanged and still yours to edit.',
    ];
    const text = replies[Math.min(this.index++, replies.length - 1)]!;

    return {
      text,
      structured: req.responseSchema ? this.options.structured : undefined,
      usage: {
        inputTokens: estimateTokens(req.messages.map((m) => m.content).join('')),
        outputTokens: estimateTokens(text),
        estimated: true,
      },
      finishReason: 'stop',
      modelId: this.id,
    };
  }

  async *stream(req: ModelRequest, ctx: CallContext): AsyncIterable<ModelChunk> {
    const result = await this.generate(req, ctx);
    for (const word of result.text.split(' ')) {
      yield { type: 'text', text: `${word} ` };
    }
    yield { type: 'done', result };
  }

  async health(): Promise<HealthStatus> {
    return { healthy: !this.options.failWith };
  }
}
