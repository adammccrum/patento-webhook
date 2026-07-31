/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  typescript: {
    tsconfigPath: '../../tsconfig.json',
  },
  eslint: {
    dirs: ['src'],
  },
  experimental: {
    esmExternals: true,
  },
};

module.exports = nextConfig;
