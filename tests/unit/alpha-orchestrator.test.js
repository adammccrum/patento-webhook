const AlphaOrchestrator = require('../../src/core/alpha-orchestrator');
const AgentRegistry = require('../../src/agents/agent-registry');
const { AGENT_STATES } = require('../../src/utils/constants');

describe('AlphaOrchestrator', () => {
  let alpha;
  let registry;

  beforeEach(() => {
    registry = new AgentRegistry();
    alpha = new AlphaOrchestrator(registry, {});
  });

  test('should create orchestrator instance', () => {
    expect(alpha.name).toBe('Alpha');
    expect(alpha.code).toBe('AA');
    expect(alpha.taskQueue).toEqual([]);
    expect(alpha.executingTasks).toBeInstanceOf(Map);
  });

  test('should receive objective and queue task', async () => {
    const objective = {
      description: 'Create test course',
      user_id: 'user1'
    };

    const response = await alpha.receiveObjective(objective);

    expect(response.task_id).toBeDefined();
    expect(response.status).toBe(AGENT_STATES.QUEUED);
    expect(response.message).toContain('queued');
    expect(alpha.taskQueue.length).toBe(1);
  });

  test('should create task with correct structure', async () => {
    const objective = {
      description: 'Test objective',
      priority: 'high'
    };

    await alpha.receiveObjective(objective);

    const task = alpha.taskQueue[0];
    expect(task.id).toBeDefined();
    expect(task.objective).toEqual(objective);
    expect(task.created_at).toBeDefined();
    expect(task.status).toBe(AGENT_STATES.QUEUED);
  });

  test('should queue multiple objectives', async () => {
    const obj1 = { description: 'Objective 1' };
    const obj2 = { description: 'Objective 2' };
    const obj3 = { description: 'Objective 3' };

    await alpha.receiveObjective(obj1);
    await alpha.receiveObjective(obj2);
    await alpha.receiveObjective(obj3);

    expect(alpha.taskQueue.length).toBe(3);
    expect(alpha.taskQueue[0].objective.description).toBe('Objective 1');
    expect(alpha.taskQueue[1].objective.description).toBe('Objective 2');
    expect(alpha.taskQueue[2].objective.description).toBe('Objective 3');
  });

  test('should get status', async () => {
    registry.registerAgents([
      {
        code: 'AA',
        name: 'Alpha',
        role: 'orchestrator',
        description: 'Executive agent',
        capabilities: [],
        permissions: [],
        restricted_actions: [],
        preferred_models: [],
        available_tools: [],
        voice_profile: 'none',
        escalation_target: null,
        enabled: true,
        current_status: AGENT_STATES.IDLE,
        last_health_check: null
      }
    ]);

    const obj1 = { description: 'Task 1' };
    const obj2 = { description: 'Task 2' };

    await alpha.receiveObjective(obj1);
    await alpha.receiveObjective(obj2);

    const status = await alpha.getStatus();

    expect(status.agent).toBe('Alpha');
    expect(status.code).toBe('AA');
    expect(status.status).toBe(AGENT_STATES.IDLE);
    expect(status.agents_registered).toBe(1);
    expect(status.tasks_queued).toBe(2);
    expect(status.tasks_executing).toBe(0);
    expect(status.timestamp).toBeDefined();
  });

  test('should track executing tasks', async () => {
    const taskId = 'task-123';
    alpha.executingTasks.set(taskId, {
      started: new Date(),
      agent: 'Echo'
    });

    const status = await alpha.getStatus();
    expect(status.tasks_executing).toBe(1);
  });

  test('should get agent statuses', async () => {
    registry.registerAgents([
      {
        code: 'AA',
        name: 'Alpha',
        role: 'orchestrator',
        description: 'Executive agent',
        capabilities: [],
        permissions: [],
        restricted_actions: [],
        preferred_models: [],
        available_tools: [],
        voice_profile: 'none',
        escalation_target: null,
        enabled: true,
        current_status: AGENT_STATES.IDLE,
        last_health_check: null
      },
      {
        code: 'BB',
        name: 'Bravo',
        role: 'analyst',
        description: 'Analysis agent',
        capabilities: [],
        permissions: [],
        restricted_actions: [],
        preferred_models: [],
        available_tools: [],
        voice_profile: 'none',
        escalation_target: null,
        enabled: true,
        current_status: AGENT_STATES.IDLE,
        last_health_check: null
      }
    ]);

    const agentStatuses = await alpha.getAgentStatuses();

    expect(agentStatuses).toBeDefined();
    expect(agentStatuses.timestamp).toBeDefined();
    expect(agentStatuses.total_agents).toBe(2);
    expect(agentStatuses.agents).toBeDefined();
  });

  test('should handle empty agent registry', async () => {
    const status = await alpha.getStatus();
    expect(status.agents_registered).toBe(0);
  });

  test('should generate unique task IDs', async () => {
    const obj = { description: 'Test' };

    const response1 = await alpha.receiveObjective(obj);
    const response2 = await alpha.receiveObjective(obj);

    expect(response1.task_id).not.toBe(response2.task_id);
  });

  test('should preserve objective data in task', async () => {
    const objective = {
      description: 'Complex objective',
      user_id: 'user123',
      priority: 'high',
      deadline: '2026-08-01',
      metadata: {
        source: 'api',
        version: 1
      }
    };

    await alpha.receiveObjective(objective);

    const task = alpha.taskQueue[0];
    expect(task.objective).toEqual(objective);
    expect(task.objective.metadata.source).toBe('api');
  });

  test('should initialize with config', () => {
    const config = {
      maxQueueSize: 100,
      timeout: 5000
    };

    const orchestrator = new AlphaOrchestrator(registry, config);
    expect(orchestrator.config).toEqual(config);
  });

  test('should handle rapid objective submission', async () => {
    const objectives = Array.from({ length: 10 }, (_, i) => ({
      description: `Objective ${i}`
    }));

    const promises = objectives.map(obj => alpha.receiveObjective(obj));
    const responses = await Promise.all(promises);

    expect(responses.length).toBe(10);
    expect(alpha.taskQueue.length).toBe(10);
    expect(new Set(responses.map(r => r.task_id)).size).toBe(10);
  });

  test('should maintain task order', async () => {
    const objectives = [
      { description: 'First' },
      { description: 'Second' },
      { description: 'Third' }
    ];

    for (const obj of objectives) {
      await alpha.receiveObjective(obj);
    }

    expect(alpha.taskQueue[0].objective.description).toBe('First');
    expect(alpha.taskQueue[1].objective.description).toBe('Second');
    expect(alpha.taskQueue[2].objective.description).toBe('Third');
  });

  test('should return ISO timestamp', async () => {
    const objective = { description: 'Test' };
    await alpha.receiveObjective(objective);

    const task = alpha.taskQueue[0];
    const timestamp = new Date(task.created_at);

    expect(timestamp).toBeInstanceOf(Date);
    expect(timestamp.toISOString()).toContain('T');
    expect(timestamp.toISOString()).toContain('Z');
  });

  test('status should return ISO timestamp', async () => {
    const status = await alpha.getStatus();
    const timestamp = new Date(status.timestamp);

    expect(timestamp).toBeInstanceOf(Date);
    expect(timestamp.toISOString()).toContain('T');
  });
});
