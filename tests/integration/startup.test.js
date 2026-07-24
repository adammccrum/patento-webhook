const ConfigLoader = require('../../src/config/config-loader');
const AgentRegistry = require('../../src/agents/agent-registry');
const ProviderRegistry = require('../../src/providers/provider-registry');
const AlphaOrchestrator = require('../../src/core/alpha-orchestrator');

describe('System Startup Integration', () => {
  let config, agentRegistry, providerRegistry, alpha;

  beforeEach(() => {
    const loader = new ConfigLoader('config');
    config = loader.loadAll();
    agentRegistry = new AgentRegistry();
    providerRegistry = new ProviderRegistry();
    alpha = new AlphaOrchestrator(agentRegistry);
  });

  test('should load configuration', () => {
    expect(config.agents).toBeDefined();
    expect(config.providers).toBeDefined();
    expect(config.agents.length).toBe(26);
  });

  test('should initialize agent registry', () => {
    agentRegistry.registerAgents(config.agents);
    expect(agentRegistry.agents.size).toBe(26);

    const validation = agentRegistry.validate();
    expect(validation.valid).toBe(true);
  });

  test('should initialize provider registry', () => {
    providerRegistry.registerProviders(config.providers);
    expect(providerRegistry.definitions.size).toBeGreaterThan(25);

    const validation = providerRegistry.validate();
    expect(validation.valid).toBe(true);
  });

  test('should initialize Alpha orchestrator', () => {
    agentRegistry.registerAgents(config.agents);
    const alphaStatus = alpha.getStatus();
    expect(alphaStatus).toBeDefined();
  });

  test('should have all 26 agents available', () => {
    agentRegistry.registerAgents(config.agents);
    const agents = agentRegistry.getEnabledAgents();
    expect(agents.length).toBe(26);
  });

  test('should have voice providers registered', () => {
    providerRegistry.registerProviders(config.providers);
    const voiceProviders = providerRegistry.getProvidersByCategory('voice');
    expect(voiceProviders.length).toBeGreaterThan(5);
  });

  test('should have media providers registered', () => {
    providerRegistry.registerProviders(config.providers);
    const mediaProviders = providerRegistry.getProvidersByCategory('media');
    expect(mediaProviders.length).toBeGreaterThan(5);
  });

  test('should have agent frameworks registered', () => {
    providerRegistry.registerProviders(config.providers);
    const agentProviders = providerRegistry.getProvidersByCategory('agents');
    expect(agentProviders.length).toBeGreaterThan(2);
  });

  test('should have all providers default to disabled', () => {
    providerRegistry.registerProviders(config.providers);
    const allProviders = providerRegistry.getDefinitions();
    const enabledProviders = allProviders.filter(p => p.enabled);
    expect(enabledProviders.length).toBe(0);
  });
});
