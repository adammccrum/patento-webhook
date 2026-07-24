const AgentRegistry = require('../../src/agents/agent-registry');
const { AGENT_STATES } = require('../../src/utils/constants');

describe('AgentRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  test('should register an agent', () => {
    const agentDef = {
      code: 'AA',
      name: 'Alpha',
      role: 'Executive Orchestrator',
      description: 'Test agent',
      capabilities: ['test'],
      permissions: [],
      enabled: true
    };

    registry.registerAgent(agentDef);
    expect(registry.agents.size).toBe(1);
  });

  test('should get agent by code', () => {
    const agentDef = {
      code: 'BB',
      name: 'Bravo',
      role: 'Engineer',
      description: 'Test',
      capabilities: ['code'],
      permissions: [],
      enabled: true
    };

    registry.registerAgent(agentDef);
    const agent = registry.getAgent('BB');
    expect(agent.name).toBe('Bravo');
  });

  test('should throw error for non-existent agent', () => {
    expect(() => registry.getAgent('XX')).toThrow();
  });

  test('should get agents by capability', () => {
    registry.registerAgent({
      code: 'CC',
      name: 'Charlie',
      role: 'Researcher',
      description: 'Test',
      capabilities: ['research'],
      permissions: [],
      enabled: true
    });

    registry.registerAgent({
      code: 'DD',
      name: 'Delta',
      role: 'Documenter',
      description: 'Test',
      capabilities: ['writing'],
      permissions: [],
      enabled: true
    });

    const researchers = registry.getAgentsByCapability('research');
    expect(researchers.length).toBe(1);
    expect(researchers[0].code).toBe('CC');
  });

  test('should update agent status', () => {
    registry.registerAgent({
      code: 'EE',
      name: 'Echo',
      role: 'Voice',
      description: 'Test',
      capabilities: ['voice'],
      permissions: [],
      enabled: true,
      current_status: AGENT_STATES.IDLE
    });

    registry.updateStatus('EE', AGENT_STATES.WORKING, { currentTask: 'test' });
    const status = registry.getStatus('EE');
    expect(status.state).toBe(AGENT_STATES.WORKING);
  });

  test('should record task completion', () => {
    registry.registerAgent({
      code: 'FF',
      name: 'Foxtrot',
      role: 'Media',
      description: 'Test',
      capabilities: ['media'],
      permissions: [],
      enabled: true
    });

    registry.recordTaskCompletion('FF');
    const status = registry.getStatus('FF');
    expect(status.completedTasks).toBe(1);
  });

  test('should record task failure', () => {
    registry.registerAgent({
      code: 'GG',
      name: 'Golf',
      role: 'Marketing',
      description: 'Test',
      capabilities: [],
      permissions: [],
      enabled: true
    });

    registry.recordTaskFailure('GG', 'Test error');
    const status = registry.getStatus('GG');
    expect(status.failedTasks).toBe(1);
    expect(status.lastError).toBe('Test error');
  });

  test('should validate agent definitions', () => {
    registry.registerAgent({
      code: 'HH',
      name: 'Hotel',
      role: 'Frontend',
      description: 'Test',
      capabilities: [],
      permissions: [],
      enabled: true
    });

    const validation = registry.validate();
    expect(validation.valid).toBe(true);
  });
});
