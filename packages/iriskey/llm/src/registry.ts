/**
 * Builds the router from environment configuration.
 *
 * This is the only place that reads provider credentials, and the only place
 * that names a vendor. Adding a provider means adding one branch here plus one
 * adapter file — nothing in the product changes.
 */

import { AnthropicAdapter } from './adapters/anthropic';
import { GeminiAdapter } from './adapters/gemini';
import { OpenAICompatibleAdapter } from './adapters/openai';
import { ScriptedAdapter } from './adapters/scripted';
import { ModelRouter } from './router';
import type { LanguageModel } from './types';

export interface RegistryEnv {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_BASE_URL?: string;

  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;

  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_BASE_URL?: string;

  /**
   * Any OpenAI-compatible server: Ollama, vLLM, llama.cpp, OpenRouter,
   * Together. This is how Llama, Qwen, DeepSeek and Hermes are reached.
   */
  OPENAI_COMPATIBLE_BASE_URL?: string;
  OPENAI_COMPATIBLE_MODEL?: string;
  OPENAI_COMPATIBLE_API_KEY?: string;
  OPENAI_COMPATIBLE_VENDOR?: string;
  /** Set when the server cannot enforce a JSON schema natively. */
  OPENAI_COMPATIBLE_NO_STRUCTURED_OUTPUT?: string;
}

export interface BuildResult {
  router: ModelRouter;
  /** True when no real provider is configured and the scripted model stands in. */
  degraded: boolean;
  /** Model ids, for diagnostics. Never rendered to a learner. */
  configured: string[];
}

export function buildRouter(env: RegistryEnv = process.env as RegistryEnv): BuildResult {
  const models: LanguageModel[] = [];

  if (env.ANTHROPIC_API_KEY) {
    models.push(
      new AnthropicAdapter({
        apiKey: env.ANTHROPIC_API_KEY,
        baseUrl: env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
        model: env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      })
    );
  }

  if (env.OPENAI_API_KEY) {
    models.push(
      new OpenAICompatibleAdapter({
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        model: env.OPENAI_MODEL || 'gpt-4o',
        vendor: 'openai',
      })
    );
  }

  if (env.GEMINI_API_KEY) {
    models.push(
      new GeminiAdapter({
        apiKey: env.GEMINI_API_KEY,
        baseUrl: env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
        model: env.GEMINI_MODEL || 'gemini-2.0-flash',
      })
    );
  }

  if (env.OPENAI_COMPATIBLE_BASE_URL && env.OPENAI_COMPATIBLE_MODEL) {
    models.push(
      new OpenAICompatibleAdapter({
        // Self-hosted servers commonly need no key.
        apiKey: env.OPENAI_COMPATIBLE_API_KEY || '',
        baseUrl: env.OPENAI_COMPATIBLE_BASE_URL,
        model: env.OPENAI_COMPATIBLE_MODEL,
        vendor: env.OPENAI_COMPATIBLE_VENDOR || 'self-hosted',
        capabilities: {
          // Self-hosted capacity is finite rather than free; cost 0 would make
          // the router always prefer it, so declare a nominal cost instead.
          inputCostPerMTok: 0.1,
          outputCostPerMTok: 0.1,
          ...(env.OPENAI_COMPATIBLE_NO_STRUCTURED_OUTPUT === 'true'
            ? { supportsStructuredOutput: false }
            : {}),
        },
      })
    );
  }

  const degraded = models.length === 0;

  if (degraded) {
    // Never throw at startup for a missing key: the product must still run,
    // and the workspace must still be usable by hand.
    models.push(new ScriptedAdapter());
  }

  return {
    router: new ModelRouter({ models }),
    degraded,
    configured: models.map((m) => m.id),
  };
}
