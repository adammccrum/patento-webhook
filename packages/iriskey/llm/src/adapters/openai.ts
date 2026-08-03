/**
 * OpenAI adapter, and by extension every OpenAI-compatible runtime.
 *
 * Ollama, vLLM, llama.cpp, OpenRouter, Together and most self-hosted servers
 * expose this same shape, so Llama, Qwen, DeepSeek and Hermes are reached
 * through this one adapter with a different base URL and declared capabilities.
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
import { extractJson, postJson, type HttpAdapterOptions, type Fetcher } from './http';

export interface OpenAICompatibleOptions extends HttpAdapterOptions {
  model: string;
  /** Reported for operations; the learner never sees it. */
  vendor?: string;
  capabilities?: Partial<ModelCapabilities>;
}

const DEFAULTS: ModelCapabilities = {
  maxContextTokens: 128_000,
  maxOutputTokens: 4_096,
  supportsStreaming: true,
  supportsStructuredOutput: true,
  supportsSystemPrompt: true,
  inputCostPerMTok: 2.5,
  outputCostPerMTok: 10,
};

export class OpenAICompatibleAdapter implements LanguageModel {
  readonly vendor: string;
  readonly id: string;
  readonly capabilities: ModelCapabilities;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly timeoutMs: number;
  private readonly model: string;

  constructor(options: OpenAICompatibleOptions) {
    this.vendor = options.vendor ?? 'openai';
    this.model = options.model;
    this.id = `${this.vendor}:${options.model}`;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.capabilities = { ...DEFAULTS, ...options.capabilities };
  }

  async generate(req: ModelRequest, ctx: CallContext): Promise<ModelResult> {
    const messages: Array<{ role: string; content: string }> = [];

    if (req.system) {
      if (this.capabilities.supportsSystemPrompt) {
        messages.push({ role: 'system', content: req.system });
      } else {
        // Some small open models ignore a system role; fold it into the first turn.
        messages.push({ role: 'user', content: req.system });
      }
    }
    messages.push(...req.messages.map((m) => ({ role: m.role, content: m.content })));

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      max_tokens: Math.min(req.maxOutputTokens, this.capabilities.maxOutputTokens),
    };

    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.stopSequences?.length) body.stop = req.stopSequences;

    // Native schema enforcement where available; prompt-and-parse where not.
    let emulatingSchema = false;
    if (req.responseSchema) {
      if (this.capabilities.supportsStructuredOutput) {
        body.response_format = {
          type: 'json_schema',
          json_schema: { name: 'response', strict: true, schema: req.responseSchema },
        };
      } else {
        emulatingSchema = true;
        const instruction =
          'Respond with a single JSON object matching this schema. No prose, no code fence.\n' +
          JSON.stringify(req.responseSchema);
        messages.push({ role: 'user', content: instruction });
      }
    }

    const raw = (await postJson(
      `${this.baseUrl}/chat/completions`,
      body,
      this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {},
      ctx.signal,
      this.fetcher,
      this.timeoutMs
    )) as OpenAIResponse;

    const choice = raw.choices?.[0];
    if (!choice) {
      throw new LLMError('TRANSIENT', 'Provider returned no choices');
    }

    const text = choice.message?.content ?? '';

    let structured: unknown;
    if (req.responseSchema) {
      structured = emulatingSchema ? extractJson(text) : safeParse(text);
    }

    return {
      text,
      structured,
      usage: raw.usage
        ? { inputTokens: raw.usage.prompt_tokens, outputTokens: raw.usage.completion_tokens }
        : {
            inputTokens: estimateTokens(messages.map((m) => m.content).join('')),
            outputTokens: estimateTokens(text),
            estimated: true,
          },
      finishReason: mapFinish(choice.finish_reason),
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

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new LLMError('TRANSIENT', 'Model did not return valid JSON');
  }
}

function mapFinish(reason?: string): ModelResult['finishReason'] {
  switch (reason) {
    case 'length':
      return 'length';
    case 'content_filter':
      return 'content_filter';
    case 'tool_calls':
      return 'tool_use';
    default:
      return 'stop';
  }
}
