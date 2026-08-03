const path = require('path');

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // The container starts `.next/standalone/apps/lao-web/server.js`. Without
  // this, Next never produces that file, so the image builds cleanly, pushes
  // cleanly, and then dies on first start with MODULE_NOT_FOUND — a failure
  // that appears only on the server, after everything looked fine.
  output: 'standalone',
  // Trace from the workspace root, so the bundle follows imports out of
  // apps/lao-web into packages/ and brings the @iriskey/* and @lao/* packages
  // with it. Without this the standalone output is missing every one of them.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  eslint: {
    dirs: ['src'],
  },
  // Workspace packages ship raw TypeScript (main: src/index.ts), so Next has
  // to compile them rather than treat them as prebuilt CommonJS.
  transpilePackages: [
    '@lao/ui',
    '@iriskey/auth',
    '@iriskey/authz',
    '@iriskey/llm',
    '@iriskey/database',
    '@iriskey/shared',
    '@iriskey/providers',
    '@iriskey/contracts',
    '@iriskey/config',
    '@iriskey/events',
    '@iriskey/audit',
    '@iriskey/middleware',
    '@iriskey/security',
    '@iriskey/ratelimit',
    '@iriskey/monitoring',
    '@iriskey/queue',
    '@iriskey/cache',
  ],
};

module.exports = nextConfig;
