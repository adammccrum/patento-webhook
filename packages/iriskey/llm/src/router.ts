/**
 * Model selection and fallback.
 *
 * Callers describe what they need; the router decides which model serves it.
 * This is the only component that knows more than one model exists.
 */

import {
  LLMError,
  estimateTokens,
  type CallContext,
  type LanguageModel,
  type ModelRequest,
  type ModelResult,
} from './types';

export interface ModelRequirements {
  needsStructuredOutput?: boolean;
  minContextTokens?: number;
  prefer?: 'quality' | 'speed' | 'cost';
}

export interface RouteTrace {
  modelId: string;
  attempts: number;
  usage: { inputTokens: number; outputTokens: number };
  costCredits: number;
}

export interface RouterOptions {
  models: LanguageModel[];
  maxAttemptsPerModel?: number;
  /** Injectable so tests do not actually wait. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class ModelRouter {
  private readonly models: LanguageModel[];
  private readonly maxAttempts: number;
  private readonly sleep: (ms: number) => Promise<void>;

  /** Models that recently failed hard, so we stop leading with them. */
  private readonly unhealthy = new Map<string, number>();

  constructor(options: RouterOptions) {
    this.models = options.models;
    this.maxAttempts = options.maxAttemptsPerModel ?? 3;
    this.sleep = options.sleep ?? defaultSleep;
  }

  get size(): number {
    return this.models.length;
  }

  /** Candidates that can serve these requirements, best first. */
  select(requirements: ModelRequirements = {}): LanguageModel[] {
    const capable = this.models.filter((m) => {
      if (requirements.needsStructuredOutput && !m.capabilities.supportsStructuredOutput) {
        return false;
      }
      if (
        requirements.minContextTokens &&
        m.capabilities.maxContextTokens < requirements.minContextTokens
      ) {
        return false;
      }
      return true;
    });

    const prefer = requirements.prefer ?? 'quality';

    return capable.sort((a, b) => {
      // A model that just failed goes last regardless of preference.
      const healthDelta = (this.unhealthy.get(a.id) ?? 0) - (this.unhealthy.get(b.id) ?? 0);
      if (healthDelta !== 0) return healthDelta;

      if (prefer === 'cost') {
        return a.capabilities.outputCostPerMTok - b.capabilities.outputCostPerMTok;
      }
      if (prefer === 'speed') {
        return a.capabilities.maxOutputTokens - b.capabilities.maxOutputTokens;
      }
      // 'quality': treat price as the available proxy, most expensive first.
      return b.capabilities.outputCostPerMTok - a.capabilities.outputCostPerMTok;
    });
  }

  /**
   * Run a request, retrying and falling back per the specification.
   *
   * Retries the same model on rate limits and transient errors; moves to the
   * next model when one is unavailable; never retries an invalid request or a
   * content refusal, because a second attempt fails the same way and costs money.
   */
  async run(
    req: ModelRequest,
    ctx: CallContext,
    requirements: ModelRequirements = {}
  ): Promise<{ result: ModelResult; trace: RouteTrace }> {
    const candidates = this.select(requirements);

    if (candidates.length === 0) {
      throw new LLMError('UNAVAILABLE', 'No model can serve this request');
    }

    let attempts = 0;
    let lastError: LLMError | undefined;

    for (const model of candidates) {
      // Refuse before spending if the estimate already exceeds the budget.
      if (ctx.budgetCredits !== undefined) {
        const estimate = this.estimateCost(model, req);
        if (estimate > ctx.budgetCredits) {
          lastError = new LLMError('BUDGET_EXCEEDED', 'This would exceed the available budget');
          continue;
        }
      }

      for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
        attempts++;
        try {
          const result = await model.generate(req, ctx);
          this.unhealthy.delete(model.id);
          return {
            result,
            trace: {
              modelId: model.id,
              attempts,
              usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens },
              costCredits: this.actualCost(model, result),
            },
          };
        } catch (error) {
          const llmError =
            error instanceof LLMError
              ? error
              : new LLMError('TRANSIENT', 'Provider call failed', String(error));
          lastError = llmError;

          // The learner left, or we asked for something impossible. Stop.
          if (
            llmError.code === 'CANCELLED' ||
            llmError.code === 'INVALID_REQUEST' ||
            llmError.code === 'CONTENT_FILTERED' ||
            llmError.code === 'BUDGET_EXCEEDED'
          ) {
            throw llmError;
          }

          if (llmError.retryableSameModel && attempt < this.maxAttempts) {
            await this.sleep(backoffMs(attempt));
            continue;
          }

          this.unhealthy.set(model.id, Date.now());
          break; // try the next model
        }
      }
    }

    throw lastError ?? new LLMError('UNAVAILABLE', 'Every model failed');
  }

  private estimateCost(model: LanguageModel, req: ModelRequest): number {
    const inputTokens = estimateTokens(
      (req.system ?? '') + req.messages.map((m) => m.content).join('')
    );
    return (
      (inputTokens / 1_000_000) * model.capabilities.inputCostPerMTok +
      (req.maxOutputTokens / 1_000_000) * model.capabilities.outputCostPerMTok
    );
  }

  private actualCost(model: LanguageModel, result: ModelResult): number {
    return (
      (result.usage.inputTokens / 1_000_000) * model.capabilities.inputCostPerMTok +
      (result.usage.outputTokens / 1_000_000) * model.capabilities.outputCostPerMTok
    );
  }
}

/** Exponential backoff with jitter, capped so a retry never feels like a hang. */
function backoffMs(attempt: number): number {
  const base = Math.min(250 * 2 ** (attempt - 1), 4_000);
  return base + Math.floor(Math.random() * 100);
}
