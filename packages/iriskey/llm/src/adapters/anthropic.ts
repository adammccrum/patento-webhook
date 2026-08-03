/**
 * Anthropic adapter.
 *
 * Translates faithfully and adds nothing: LAO's voice belongs to the
 * collaborator service, not here, so changing provider cannot change tone.
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

export interface AnthropicOptions extends HttpAdapterOptions {
  model: string;
  capabilities?: Partial<ModelCapabilities>;
}

const DEFAULTS: ModelCapabilities = {
  maxContextTokens: 200_000,
  maxOutputTokens: 8_192,
  supportsStreaming: true,
  supportsStructuredOutput: true, // via forced tool use
  supportsSystemPrompt: true,
  inputCostPerMTok: 3,
  outputCostPerMTok: 15,
};

export class AnthropicAdapter implements LanguageModel {
  readonly vendor = 'anthropic';
  readonly id: string;
  readonly capabilities: ModelCapabilities;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: Fetcher;
  private readonly timeoutMs: number;
  private readonly model: string;

  constructor(options: AnthropicOptions) {
    this.model = options.model;
    this.id = `anthropic:${options.model}`;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.capabilities = { ...DEFAULTS, ...options.capabilities };
  }

  async generate(req: ModelRequest, ctx: CallContext): Promise<ModelResult> {
    // Anthropic takes the system prompt as a top-level field, not a message.
    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: Math.min(req.maxOutputTokens, this.capabilities.maxOutputTokens),
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    };

    if (req.system) body.system = req.system;
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.stopSequences?.length) body.stop_sequences = req.stopSequences;

    // Structured output is expressed as a single forced tool call.
    if (req.responseSchema) {
      body.tools = [
        {
          name: 'respond',
          description: 'Return the response in the required structure.',
          input_schema: req.responseSchema,
        },
      ];
      body.tool_choice = { type: 'tool', name: 'respond' };
    }

    const raw = (await postJson(
      `${this.baseUrl}/v1/messages`,
      body,
      {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      ctx.signal,
      this.fetcher,
      this.timeoutMs
    )) as AnthropicResponse;

    return this.parse(raw, req);
  }

  private parse(raw: AnthropicResponse, req: ModelRequest): ModelResult {
    const blocks = raw.content ?? [];

    const text = blocks
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');

    const toolBlock = blocks.find((b) => b.type === 'tool_use');

    if (req.responseSchema && !toolBlock) {
      throw new LLMError('TRANSIENT', 'Model did not return the required structure');
    }

    const usage = raw.usage;

    return {
      text,
      structured: toolBlock?.input,
      usage: usage
        ? { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }
        : {
            inputTokens: estimateTokens(req.messages.map((m) => m.content).join('')),
            outputTokens: estimateTokens(text),
            estimated: true,
          },
      finishReason: mapStop(raw.stop_reason),
      modelId: this.id,
    };
  }

  async *stream(req: ModelRequest, ctx: CallContext): AsyncIterable<ModelChunk> {
    // Non-streaming fallback: correct, just not incremental. Replacing this
    // with SSE parsing is a contained change behind the same interface.
    const result = await this.generate(req, ctx);
    if (result.text) yield { type: 'text', text: result.text };
    yield { type: 'done', result };
  }

  async health(): Promise<HealthStatus> {
    try {
      await this.generate(
        { messages: [{ role: 'user', content: 'ok' }], maxOutputTokens: 1 },
        {
          signal: AbortSignal.timeout(10_000),
          tenantId: 'health',
          requestId: 'health',
        }
      );
      return { healthy: true };
    } catch (error) {
      return { healthy: false, detail: error instanceof Error ? error.message : String(error) };
    }
  }
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string; input?: unknown }>;
  usage?: { input_tokens: number; output_tokens: number };
  stop_reason?: string;
}

function mapStop(reason?: string): ModelResult['finishReason'] {
  switch (reason) {
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool_use';
    default:
      return 'stop';
  }
}
