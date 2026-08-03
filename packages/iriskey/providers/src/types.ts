/**
 * Provider interface definitions
 */

/**
 * Provider health status
 */
export enum ProviderHealth {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  enabled: boolean;
  priority: number;
  config: Record<string, any>;
  secrets: Record<string, string>;
}

/**
 * Provider types
 */
export enum ProviderType {
  LLM = 'llm',
  IMAGE = 'image',
  VIDEO = 'video',
  VOICE = 'voice',
  EMBEDDING = 'embedding',
  TRANSCRIPTION = 'transcription',
}

/**
 * Provider interface for all implementations
 */
export interface IProvider {
  id: string;
  name: string;
  type: ProviderType;

  /**
   * Check if provider is healthy and available
   */
  health(): Promise<ProviderHealth>;

  /**
   * Get estimated cost for operation
   * @param operation - The operation type (e.g., 'llm_chat', 'image_generation')
   * @param metadata - Additional metadata for cost calculation
   * @returns Cost in credits
   */
  estimateCost(operation: string, metadata: Record<string, any>): Promise<number>;

  /**
   * Get provider capabilities and limits
   */
  getCapabilities(): Record<string, any>;
}

/**
 * LLM Provider interface
 */
export interface ILLMProvider extends IProvider {
  type: ProviderType.LLM;

  /**
   * Send a completion request
   */
  complete(prompt: string, options?: Record<string, any>): Promise<string>;

  /**
   * Stream a completion
   */
  completeStream(prompt: string, options?: Record<string, any>): AsyncIterableIterator<string>;

  /**
   * Send a chat request
   */
  chat(messages: ChatMessage[], options?: Record<string, any>): Promise<ChatMessage>;

  /**
   * Stream a chat response
   */
  chatStream(messages: ChatMessage[], options?: Record<string, any>): AsyncIterableIterator<string>;

  /**
   * Get available models
   */
  getModels(): Promise<string[]>;
}

/**
 * Chat message structure
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Image Provider interface
 */
export interface IImageProvider extends IProvider {
  type: ProviderType.IMAGE;

  /**
   * Generate an image from a prompt
   */
  generate(prompt: string, options?: Record<string, any>): Promise<string>;

  /**
   * Get available models
   */
  getModels(): Promise<string[]>;
}

/**
 * Video Provider interface
 */
export interface IVideoProvider extends IProvider {
  type: ProviderType.VIDEO;

  /**
   * Generate a video from a prompt
   */
  generate(prompt: string, options?: Record<string, any>): Promise<string>;

  /**
   * Get available models
   */
  getModels(): Promise<string[]>;
}

/**
 * Voice Provider interface
 */
export interface IVoiceProvider extends IProvider {
  type: ProviderType.VOICE;

  /**
   * Convert text to speech
   */
  synthesize(text: string, options?: Record<string, any>): Promise<Buffer>;

  /**
   * Transcribe audio to text
   */
  transcribe(audio: Buffer, options?: Record<string, any>): Promise<string>;

  /**
   * Get available voices
   */
  getVoices(): Promise<string[]>;
}

/**
 * Embedding Provider interface
 */
export interface IEmbeddingProvider extends IProvider {
  type: ProviderType.EMBEDDING;

  /**
   * Generate embeddings for text
   */
  embed(text: string | string[], options?: Record<string, any>): Promise<number[][]>;

  /**
   * Get embedding dimension
   */
  getDimension(): Promise<number>;
}

/**
 * Provider metrics for monitoring
 */
export interface ProviderMetrics {
  providerId: string;
  timestamp: Date;
  health: ProviderHealth;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  errorRate: number;
  lastError?: string;
}

/**
 * Cost calculation metadata
 */
export interface CostMetadata {
  inputTokens?: number;
  outputTokens?: number;
  imageSize?: string;
  videoDuration?: number;
  audioLength?: number;
  customMetadata?: Record<string, any>;
}
