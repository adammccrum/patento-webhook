/**
 * IrisKey Platform - Provider-agnostic language model access.
 *
 * Product code must not import from this package directly. It exists so that
 * one layer — the collaborator service — can reach a model without any feature
 * knowing which model, or which vendor, served the request.
 */

export {
  LLMError,
  errorFromStatus,
  estimateTokens,
  RETRYABLE_OTHER_MODEL,
  RETRYABLE_SAME_MODEL,
  type CallContext,
  type HealthStatus,
  type LanguageModel,
  type LLMErrorCode,
  type ModelCapabilities,
  type ModelChunk,
  type ModelMessage,
  type ModelRequest,
  type ModelResult,
  type ModelUsage,
} from './types';

export { ModelRouter, type ModelRequirements, type RouteTrace, type RouterOptions } from './router';

export { buildRouter, type BuildResult, type RegistryEnv } from './registry';

export { AnthropicAdapter, type AnthropicOptions } from './adapters/anthropic';
export { GeminiAdapter, type GeminiOptions } from './adapters/gemini';
export {
  OpenAICompatibleAdapter,
  type OpenAICompatibleOptions,
} from './adapters/openai';
export { ScriptedAdapter, type ScriptedOptions } from './adapters/scripted';
export { extractJson, postJson, type Fetcher, type HttpAdapterOptions } from './adapters/http';
