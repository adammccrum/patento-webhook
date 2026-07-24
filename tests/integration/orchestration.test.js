const ConfigLoader = require('../../src/config/config-loader');
const AgentRegistry = require('../../src/agents/agent-registry');
const ProviderRegistry = require('../../src/providers/provider-registry');
const AlphaOrchestratorV2 = require('../../src/core/alpha-orchestrator-v2');
const { Objective, OBJECTIVE_TYPES } = require('../../src/orchestration/task-schema');

describe('Orchestration Integration', () => {
  let loader, agentRegistry, providerRegistry, alpha;

  beforeEach(() => {
    loader = new ConfigLoader('config');
    const config = loader.loadAll();

    agentRegistry = new AgentRegistry();
    providerRegistry = new ProviderRegistry();

    agentRegistry.registerAgents(config.agents);
    providerRegistry.registerProviders(config.providers);

    alpha = new AlphaOrchestratorV2(agentRegistry, providerRegistry);
  });

  test('should initialize Alpha orchestrator', () => {
    expect(alpha.name).toBe('Alpha');
    expect(alpha.code).toBe('AA');
    expect(alpha.classifier).toBeDefined();
    expect(alpha.planner).toBeDefined();
    expect(alpha.executor).toBeDefined();
  });

  test('should classify user objective', () => {
    const classification = alpha.classifyObjective('Write a blog article about AI');

    expect(classification.type).toBe(OBJECTIVE_TYPES.CREATE_CONTENT);
    expect(classification.suggested_agents).toBeDefined();
    expect(classification.suggested_agents.length).toBeGreaterThan(0);
  });

  test('should plan task without executing', () => {
    const objective = new Objective({
      description: 'Create comprehensive documentation',
      user_id: 'user123'
    });

    const plan = alpha.planOnly({
      ...objective,
      description: objective.description
    });

    expect(plan.task_id).toBeDefined();
    expect(plan.subtasks).toBeDefined();
    expect(plan.total_subtasks).toBeGreaterThan(0);

    // Check subtasks have required fields
    for (const st of plan.subtasks) {
      expect(st.title).toBeDefined();
      expect(st.agent_code).toBeDefined();
      expect(st.agent_name).toBeDefined();
      expect(st.capability).toBeDefined();
    }
  });

  test('should receive objective and create task', async () => {
    const response = await alpha.receiveObjective({
      description: 'Analyze customer data and generate insights',
      user_id: 'user123',
      context: { source: 'api' }
    });

    expect(response.objective_id).toBeDefined();
    expect(response.task_id).toBeDefined();
    expect(response.status).toBe('planned');
    expect(response.subtask_count).toBeGreaterThan(0);
  });

  test('should track objective status', async () => {
    const response = await alpha.receiveObjective({
      description: 'Create training materials',
      user_id: 'user123'
    });

    const status = alpha.getObjectiveStatus(response.objective_id);

    expect(status.objective_id).toBeDefined();
    expect(status.description).toBeDefined();
    expect(status.tasks).toBeDefined();
    expect(status.tasks.length).toBeGreaterThan(0);
  });

  test('should execute task with dependencies', async () => {
    const response = await alpha.receiveObjective({
      description: 'Write and publish documentation',
      user_id: 'user123'
    });

    const taskId = response.task_id;
    const task = alpha.tasks.get(taskId);

    // Verify subtasks have dependencies
    let hasDependencies = false;
    for (const st of task.subtasks) {
      if (st.dependencies.length > 0) {
        hasDependencies = true;
        break;
      }
    }

    expect(hasDependencies).toBe(true);

    // Execute the task
    const executionResult = await alpha.executeTask(taskId);

    expect(executionResult.success).toBe(true);
    expect(executionResult.task_id).toBe(taskId);
    expect(executionResult.results).toBeDefined();
  });

  test('should aggregate results from subtasks', async () => {
    const response = await alpha.receiveObjective({
      description: 'Process and analyze data',
      user_id: 'user123'
    });

    const result = await alpha.executeTask(response.task_id);

    expect(result.results.task_id).toBeDefined();
    expect(result.results.status).toBe('completed');
    expect(result.results.final_results).toBeDefined();
    expect(result.results.execution_time_ms).toBeGreaterThan(0);
  });

  test('should generate audit trail', async () => {
    const response = await alpha.receiveObjective({
      description: 'Create content with audit trail',
      user_id: 'user123'
    });

    const taskId = response.task_id;
    await alpha.executeTask(taskId);

    const auditTrail = alpha.getTaskAuditLog(taskId);

    expect(auditTrail.length).toBeGreaterThan(0);

    // Should have various event types
    const eventTypes = new Set(auditTrail.map(e => e.event_type));
    expect(eventTypes.size).toBeGreaterThan(1);
  });

  test('should export audit trail in JSON format', async () => {
    const response = await alpha.receiveObjective({
      description: 'Test audit export',
      user_id: 'user123'
    });

    await alpha.executeTask(response.task_id);

    const json = alpha.exportAuditTrail('json');

    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    expect(json[0].event_type).toBeDefined();
    expect(json[0].timestamp).toBeDefined();
  });

  test('should export audit trail in CSV format', async () => {
    const response = await alpha.receiveObjective({
      description: 'Test CSV export',
      user_id: 'user123'
    });

    await alpha.executeTask(response.task_id);

    const csv = alpha.exportAuditTrail('csv');

    expect(typeof csv).toBe('string');
    expect(csv).toContain('timestamp');
    expect(csv).toContain('event_type');
  });

  test('should return orchestrator status', () => {
    const status = alpha.getStatus();

    expect(status.agent).toBe('Alpha');
    expect(status.code).toBe('AA');
    expect(status.objectives_received).toBeGreaterThanOrEqual(0);
    expect(status.tasks_created).toBeGreaterThanOrEqual(0);
  });

  test('should handle multiple objectives in parallel', async () => {
    const obj1 = alpha.receiveObjective({
      description: 'First task',
      user_id: 'user1'
    });

    const obj2 = alpha.receiveObjective({
      description: 'Second task',
      user_id: 'user2'
    });

    const [resp1, resp2] = await Promise.all([obj1, obj2]);

    expect(resp1.objective_id).not.toBe(resp2.objective_id);
    expect(alpha.objectives.size).toBe(2);
  });

  test('should handle objective without executing', async () => {
    const response = await alpha.receiveObjective({
      description: 'Planned but not executed',
      user_id: 'user123'
    });

    const task = alpha.tasks.get(response.task_id);
    expect(task.state).toBe('pending');

    // Task should still be planned but not executed
    const status = alpha.getObjectiveStatus(response.objective_id);
    expect(status.tasks[0].state).toBe('pending');
  });
});
