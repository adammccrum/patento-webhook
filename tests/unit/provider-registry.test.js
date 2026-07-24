const ProviderRegistry = require('../../src/providers/provider-registry');

describe('ProviderRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  test('should register a provider definition', () => {
    registry.registerProvider({
      provider_id: 'test-provider',
      name: 'Test Provider',
      category: 'voice',
      enabled: true
    });

    expect(registry.definitions.size).toBe(1);
  });

  test('should get provider definition', () => {
    registry.registerProvider({
      provider_id: 'voicebox',
      name: 'Voicebox',
      category: 'voice',
      enabled: true
    });

    const def = registry.getDefinition('voicebox');
    expect(def.name).toBe('Voicebox');
  });

  test('should get providers by category', () => {
    registry.registerProvider({
      provider_id: 'voice-1',
      name: 'Voice Provider 1',
      category: 'voice',
      enabled: true
    });

    registry.registerProvider({
      provider_id: 'media-1',
      name: 'Media Provider 1',
      category: 'media',
      enabled: true
    });

    const voiceProviders = registry.getProvidersByCategory('voice');
    expect(voiceProviders.length).toBe(1);
    expect(voiceProviders[0].category).toBe('voice');
  });

  test('should get enabled definitions only', () => {
    registry.registerProvider({
      provider_id: 'enabled',
      name: 'Enabled',
      category: 'voice',
      enabled: true
    });

    registry.registerProvider({
      provider_id: 'disabled',
      name: 'Disabled',
      category: 'voice',
      enabled: false
    });

    const enabled = registry.getEnabledDefinitions();
    expect(enabled.length).toBe(1);
    expect(enabled[0].provider_id).toBe('enabled');
  });

  test('should validate provider definitions', () => {
    registry.registerProvider({
      provider_id: 'valid',
      name: 'Valid Provider',
      category: 'voice',
      enabled: true
    });

    const validation = registry.validate();
    expect(validation.valid).toBe(true);
  });

  test('should return status report', () => {
    registry.registerProvider({
      provider_id: 'test',
      name: 'Test',
      category: 'voice',
      enabled: true
    });

    const status = registry.getStatus();
    expect(status.timestamp).toBeDefined();
    expect(status.total_providers).toBe(1);
    expect(status.enabled_providers).toBe(1);
  });
});
