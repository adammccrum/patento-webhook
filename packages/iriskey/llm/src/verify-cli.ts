/**
 * Runs the provider verification matrix against whatever is configured.
 *
 *   npm run verify-providers --workspace=@iriskey/llm
 *
 * Reads the same environment variables the product does, so it verifies the
 * real configuration rather than a parallel one. Exits non-zero if any
 * configured provider fails, so it can gate a release.
 */

import { buildRouter } from './registry';
import { formatReport, verifyProvider } from './verify';

async function main(): Promise<void> {
  const { degraded, configured } = buildRouter();

  if (degraded) {
    console.error(
      '\nNo provider is configured, so there is nothing to verify.\n' +
        'Set one of ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, or\n' +
        'OPENAI_COMPATIBLE_BASE_URL + OPENAI_COMPATIBLE_MODEL, then re-run.\n'
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\nVerifying ${configured.length} provider(s). This makes real calls.\n`);

  const { router } = buildRouter();
  const models = router.registered;

  let allPassed = true;

  for (const model of models) {
    const report = await verifyProvider(model);
    console.log(formatReport(report));
    if (!report.passed) allPassed = false;
  }

  console.log(
    allPassed
      ? '\nAll configured providers passed.\n'
      : '\nOne or more providers failed. Do not invite learners until they pass.\n'
  );

  process.exitCode = allPassed ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
