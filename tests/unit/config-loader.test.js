const ConfigLoader = require('../../src/config/config-loader');

describe('ConfigLoader', () => {
  let loader;

  beforeEach(() => {
    loader = new ConfigLoader('config');
  });

  test('should load agent configuration', () => {
    const agents = loader.loadAgentsConfig();
    expect(agents).toBeDefined();
    expect(Array.isArray(agents)).toBe(true);
    expect(agents.length).toBe(26);
  });

  test('should load provider configuration', () => {
    const providers = loader.loadProvidersConfig();
    expect(providers).toBeDefined();
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.length > 25).toBe(true);
  });

  test('should have Alpha agent', () => {
    const agents = loader.loadAgentsConfig();
    const alpha = agents.find(a => a.code === 'AA');
    expect(alpha).toBeDefined();
    expect(alpha.name).toBe('Alpha');
    expect(alpha.role).toBe('Executive Orchestrator');
  });

  test('should have all 26 NATO agents', () => {
    const agents = loader.loadAgentsConfig();
    const codes = ['AA', 'BB', 'CC', 'DD', 'EE', 'FF', 'GG', 'HH', 'II', 'JJ', 'KK', 'LL', 'MM', 'NN', 'OO', 'PP', 'QQ', 'RR', 'SS', 'TT', 'UU', 'VV', 'WW', 'XX', 'YY', 'ZZ'];
    for (const code of codes) {
      const agent = agents.find(a => a.code === code);
      expect(agent).toBeDefined();
    }
  });

  test('should load all configurations', () => {
    const config = loader.loadAll();
    expect(config.agents).toBeDefined();
    expect(config.providers).toBeDefined();
    expect(config.env).toBeDefined();
  });

  test('should get environment variables safely', () => {
    const value = loader.getEnvSafe('NONEXISTENT', 'default');
    expect(value).toBe('default');
  });
});
