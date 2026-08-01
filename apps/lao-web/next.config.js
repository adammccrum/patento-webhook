/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    dirs: ['src'],
  },
  // Workspace packages ship raw TypeScript (main: src/index.ts), so Next has
  // to compile them rather than treat them as prebuilt CommonJS.
  transpilePackages: [
    '@lao/ui',
    '@iriskey/auth',
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
