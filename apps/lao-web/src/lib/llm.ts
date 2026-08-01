/**
 * The app's single connection to the model layer.
 *
 * Built once per process. This is the only file in the application that imports
 * @iriskey/llm; everything else goes through the collaborator.
 */

import { buildRouter, type BuildResult } from '@iriskey/llm';

let cached: BuildResult | null = null;

export function getRouter(): BuildResult {
  if (!cached) {
    cached = buildRouter();

    if (cached.degraded) {
      // Worth saying once at startup, not on every request.
      console.warn(
        '[llm] No provider configured. The collaborator will explain that it cannot ' +
          'suggest improvements; solutions remain fully editable by hand.'
      );
    } else {
      console.info(`[llm] ${cached.configured.length} model(s) configured.`);
    }
  }
  return cached;
}

/** Tests reset between cases. */
export function resetRouter(): void {
  cached = null;
}
