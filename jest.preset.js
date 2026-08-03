/**
 * Shared Jest configuration for @iriskey/* packages.
 *
 * Each package's jest.config.js extends this so test setup lives in one place.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.next/'],
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        // Package sources are consumed as TS; type errors are caught by
        // `turbo run type-check`, so tests don't re-report them here.
        isolatedModules: true,
        diagnostics: false,
        tsconfig: {
          allowJs: true,
          esModuleInterop: true,
          module: 'CommonJS',
          target: 'ES2020',
        },
      },
    ],
  },
};
