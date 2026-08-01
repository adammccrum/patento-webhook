/**
 * Shared HTTP plumbing for vendor adapters.
 *
 * Injecting the transport keeps adapters testable: the request shaping and
 * response parsing — where the bugs actually live — can be verified without a
 * network or an API key.
 */

import { LLMError, errorFromStatus } from '../types';

export type Fetcher = typeof fetch;

export interface HttpAdapterOptions {
  apiKey: string;
  baseUrl: string;
  /** Defaults to global fetch; tests supply a stub. */
  fetcher?: Fetcher;
  timeoutMs?: number;
}

export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  signal: AbortSignal,
  fetcher: Fetcher = fetch,
  timeoutMs = 60_000
): Promise<unknown> {
  // Combine the caller's cancellation with our own timeout so neither is lost.
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), timeoutMs);
  const onAbort = () => timeout.abort();
  signal.addEventListener('abort', onAbort);

  try {
    const response = await fetcher(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: timeout.signal,
    });

    if (!response.ok) {
      throw errorFromStatus(response.status, await safeText(response));
    }

    return await response.json();
  } catch (error) {
    if (error instanceof LLMError) throw error;

    if (isAbort(error)) {
      // Distinguish "the learner left" from "the provider was too slow".
      throw signal.aborted
        ? new LLMError('CANCELLED', 'Request cancelled')
        : new LLMError('TRANSIENT', 'Provider timed out');
    }

    throw new LLMError('UNAVAILABLE', 'Could not reach provider', String(error));
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

function isAbort(error: unknown): boolean {
  return (
    error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 2000);
  } catch {
    return '';
  }
}

/**
 * Pull the first JSON object out of a model's prose.
 *
 * Needed by adapters emulating structured output on models that lack it: they
 * are asked for JSON and often wrap it in a fenced block or a sentence.
 */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? text.trim();

  try {
    return JSON.parse(candidate);
  } catch {
    // Fall back to the outermost balanced braces.
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new LLMError('TRANSIENT', 'Model did not return usable JSON', text.slice(0, 500));
  }
}
