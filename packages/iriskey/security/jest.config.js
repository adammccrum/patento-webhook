module.exports = {
  ...require('../../../jest.preset.js'),
  rootDir: __dirname,
  // isomorphic-dompurify loads jsdom when there is no global `window`, and
  // jsdom's dependency chain is ESM-only. Running in a jsdom environment gives
  // it a window, so it takes the browser path and stays CommonJS.
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.setup.js'],
};
