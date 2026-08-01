/**
 * Gemini adapter.
 *
 * Gemini's shape differs most from the others: roles are user/model rather than
 * user/assistant, the system prompt is a separate field, and content is nested
 * in parts. All of that is absorbed here.
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
import { postJson, type HttpAdapterOptions, type Fetcher } from './http';

export interface GeminiOptions extends HttpAdapterOptions {
  model: string;
  capabilities?: Partial<ModelCapabilities>;
}

const DEFAULTS: ModelCapabilities = {
  maxContextTokens: 1_000_000,
  maxOutputTokens: 8_192,
  supportsStreaming: true,
  supportsStructuredOutput: true,
  supportsSystemPrompt: true,
  inputCostPerMTok: 1.25,
  outputCostPerMTok: 5,
};

export class GeminiAdapter implements LanguageModel {
  readonly vendor = 'gemini';
  readonly id: string;
  readonly capabilities: ModelCapabilities;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly timeoutMs: number;
  private readonly model: string;

  constructor(options: GeminiOptions) {
    this.model = options.model;
    this.id = `gemini:${options.model}`;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.capabilities = { ...DEFAULTS, ...options.capabilities };
  }

  async generate(req: ModelRequest, ctx: CallContext): Promise<ModelResult> {
    const body: Record<string, unknown> = {
      // Gemini calls the assistant 'model'.
      contents: req.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        maxOutputTokens: Math.min(req.maxOutputTokens, this.capabilities.maxOutputTokens),
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        ...(req.stopSequences?.length ? { stopSequences: req.stopSequences } : {}),
        ...(req.responseSchema
          ? { responseMimeType: 'application/json', responseSchema: req.responseSchema }
          : {}),
      },
    };

    if (req.system) {
      body.systemInstruction = { parts: [{ text: req.system }] };
    }

    const raw = (await postJson(
      `${this.baseUrl}/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
      body,
      {},
      ctx.signal,
      this.fetcher,
      this.timeoutMs
    )) as GeminiResponse;

    const candidate = raw.candidates?.[0];
    if (!candidate) {
      // A prompt blocked upstream reports no candidates at all.
      if (raw.promptFeedback?.blockReason) {
        throw new LLMError('CONTENT_FILTERED', 'The request was refused', raw.promptFeedback.blockReason);
      }
      throw new LLMError('TRANSIENT', 'Provider returned no candidates');
    }

    if (candidate.finishReason === 'SAFETY') {
      throw new LLMError('CONTENT_FILTERED', 'The response was refused');
    }

    const text = (candidate.content?.parts ?? []).map((p) => p.text ?? '').join('');

    let structured: unknown;
    if (req.responseSchema) {
      try {
        structured = JSON.parse(text);
      } catch {
        throw new LLMError('TRANSIENT', 'Model did not return valid JSON');
      }
    }

    const usage = raw.usageMetadata;

    return {
      text,
      structured,
      usage: usage
        ? {
            inputTokens: usage.promptTokenCount,
            outputTokens: usage.candidatesTokenCount,
          }
        : {
            inputTokens: estimateTokens(req.messages.map((m) => m.content).join('')),
            outputTokens: estimateTokens(text),
            estimated: true,
          },
      finishReason: candidate.finishReason === 'MAX_TOKENS' ? 'length' : 'stop',
      modelId: this.id,
    };
  }

  async *stream(req: ModelRequest, ctx: CallContext): AsyncIterable<ModelChunk> {
    const result = await this.generate(req, ctx);
    if (result.text) yield { type: 'text', text: result.text };
    yield { type: 'done', result };
  }

  async health(): Promise<HealthStatus> {
    try {
      await this.generate(
        { messages: [{ role: 'user', content: 'ok' }], maxOutputTokens: 1 },
        { signal: AbortSignal.timeout(10_000), tenantId: 'health', requestId: 'health' }
      );
      return { healthy: true };
    } catch (error) {
      return { healthy: false, detail: error instanceof Error ? error.message : String(error) };
    }
  }
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
  promptFeedback?: { blockReason?: string };
}
