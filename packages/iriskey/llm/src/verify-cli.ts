/**
 * Runs the provider verification matrix against whatever is configured.
 *
 *   npm run verify-providers --workspace=@iriskey/llm
 *
 * Reads the same environment variables the product does, so it verifies the
 * real configuration rather than a parallel one. Exits non-zero if any
 * configured provider fails, so it can gate a release.
 */

import { execFileSync } from 'child_process';
import { buildRouter } from './registry';
import { formatReport, verifyProvider } from './verify';

/** The commit under test. Unknown is an honest answer; a guess is not. */
function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function main(): Promise<void> {
  // Once. Building it twice made two sets of clients and read the environment
  // twice, so the thing verified was not quite the thing reported on.
  const { degraded, configured, router } = buildRouter();

  if (degraded) {
    console.error(
      '\nNo provider is configured, so there is nothing to verify.\n' +
        'Set one of ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, or\n' +
        'OPENAI_COMPATIBLE_BASE_URL + OPENAI_COMPATIBLE_MODEL, then re-run.\n'
    );
    process.exitCode = 1;
    return;
  }

  // A release decision must be reproducible from the archived output alone,
  // so the output carries who ran it, where, against what commit.
  console.log('LAO provider verification');
  console.log(`  timestamp    ${new Date().toISOString()}`);
  console.log(`  commit       ${commit()}`);
  console.log(`  environment  ${process.env.LLM_ENVIRONMENT ?? 'local'}`);
  console.log(`  operator     ${process.env.LLM_OPERATOR ?? process.env.USER ?? 'unknown'}`);
  console.log(`  providers    ${configured.join(', ')}`);
  console.log(`  models       ${router.registered.map((m) => m.id).join(', ')}`);
  console.log(`\nVerifying ${configured.length} provider(s). This makes real calls.\n`);

  let allPassed = true;
  const warnings: string[] = [];

  for (const model of router.registered) {
    const report = await verifyProvider(model);
    console.log(formatReport(report));
    if (!report.passed) allPassed = false;
    for (const r of report.results.filter((c) => c.warning)) {
      warnings.push(`${report.modelId} — ${r.name}: ${r.detail}`);
    }
  }

  if (warnings.length) {
    // A pass with a known degradation must not read as a clean pass in the
    // evidence someone files.
    console.log('\nPassed with warnings:');
    for (const w of warnings) console.log(`  ! ${w}`);
  }

  console.log(
    allPassed
      ? `\nAll configured providers passed${warnings.length ? ' — with the warnings above' : ''}.\n`
      : '\nOne or more providers failed. Do not invite learners until they pass.\n'
  );

  process.exitCode = allPassed ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
