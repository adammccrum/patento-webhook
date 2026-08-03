/**
 * The LanguageModel port.
 *
 * Only the router and the adapters speak this vocabulary. Product code speaks
 * the Collaborator vocabulary instead, so tokens, temperature and vendor names
 * never reach a feature.
 */

export interface ModelCapabilities {
  maxContextTokens: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  /** Native JSON-schema-constrained output. Adapters must not overstate this. */
  supportsStructuredOutput: boolean;
  supportsSystemPrompt: boolean;
  /** Cost per million tokens, in credits. Zero for self-hosted models. */
  inputCostPerMTok: number;
  outputCostPerMTok: number;
}

export interface ModelMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ModelRequest {
  system?: string;
  messages: ModelMessage[];
  maxOutputTokens: number;
  temperature?: number;
  /** When set, the result must conform. Adapters emulate or decline. */
  responseSchema?: Record<string, unknown>;
  stopSequences?: string[];
}

export interface CallContext {
  /** Closing the workspace must abort generation, not just stop reading. */
  signal: AbortSignal;
  /** Opaque. Vendors never receive a learner's identity. */
  tenantId: string;
  requestId: string;
  budgetCredits?: number;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  /** True when the vendor gave no counts and these are estimated. */
  estimated?: boolean;
}

export interface ModelResult {
  text: string;
  /** Parsed and validated when responseSchema was set. */
  structured?: unknown;
  usage: ModelUsage;
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_use';
  modelId: string;
}

export interface ModelChunk {
  type: 'text' | 'done' | 'error';
  text?: string;
  result?: ModelResult;
  error?: LLMError;
}

export interface HealthStatus {
  healthy: boolean;
  detail?: string;
}

export interface LanguageModel {
  readonly id: string;
  /** Operational only. Never surfaced to a learner. */
  readonly vendor: string;
  readonly capabilities: ModelCapabilities;

  generate(req: ModelRequest, ctx: CallContext): Promise<ModelResult>;
  stream(req: ModelRequest, ctx: CallContext): AsyncIterable<ModelChunk>;
  health(): Promise<HealthStatus>;
}

/* ------------------------------------------------------------------ errors */

export type LLMErrorCode =
  | 'RATE_LIMITED'
  | 'TRANSIENT'
  | 'UNAVAILABLE'
  | 'INVALID_REQUEST'
  | 'CONTENT_FILTERED'
  | 'BUDGET_EXCEEDED'
  | 'CANCELLED';

/** Codes worth trying again on the same model. */
export const RETRYABLE_SAME_MODEL: readonly LLMErrorCode[] = ['RATE_LIMITED', 'TRANSIENT'];

/** Codes worth trying on a different model. */
export const RETRYABLE_OTHER_MODEL: readonly LLMErrorCode[] = [
  'UNAVAILABLE',
  'RATE_LIMITED',
  'TRANSIENT',
];

export class LLMError extends Error {
  constructor(
    readonly code: LLMErrorCode,
    message: string,
    /** Vendor detail for logs. Never rendered to a learner. */
    readonly detail?: string
  ) {
    super(message);
    this.name = 'LLMError';
  }

  get retryableSameModel(): boolean {
    return RETRYABLE_SAME_MODEL.includes(this.code);
  }

  get retryableOtherModel(): boolean {
    return RETRYABLE_OTHER_MODEL.includes(this.code);
  }
}

/** Map an HTTP status to the taxonomy. Shared by every HTTP adapter. */
export function errorFromStatus(status: number, body: string): LLMError {
  if (status === 429) return new LLMError('RATE_LIMITED', 'Rate limited', body);
  if (status === 400 || status === 422) return new LLMError('INVALID_REQUEST', 'Invalid request', body);
  if (status === 401 || status === 403) {
    // A bad key is our problem, not the learner's, and retrying will not help.
    return new LLMError('INVALID_REQUEST', 'Provider rejected credentials', body);
  }
  if (status >= 500) return new LLMError('TRANSIENT', 'Provider error', body);
  return new LLMError('UNAVAILABLE', `Unexpected status ${status}`, body);
}

/**
 * Rough token estimate, for adapters whose vendor reports no usage and for
 * pre-flight budgeting. Deliberately conservative: ~4 characters per token.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
