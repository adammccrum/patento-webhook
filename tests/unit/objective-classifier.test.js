const ObjectiveClassifier = require('../../src/orchestration/objective-classifier');
const AgentRegistry = require('../../src/agents/agent-registry');
const { Objective, OBJECTIVE_TYPES } = require('../../src/orchestration/task-schema');

describe('ObjectiveClassifier', () => {
  let classifier, registry;

  beforeEach(() => {
    registry = new AgentRegistry();
    classifier = new ObjectiveClassifier(registry);
  });

  test('should classify content creation objective', () => {
    const obj = new Objective({
      description: 'Write a blog article about machine learning',
      user_id: 'user1'
    });

    const classification = classifier.classify(obj);

    expect(classification.type).toBe(OBJECTIVE_TYPES.CREATE_CONTENT);
    expect(classification.confidence).toBeGreaterThan(0);
  });

  test('should classify data analysis objective', () => {
    const obj = new Objective({
      description: 'Analyze customer metrics and create dashboards',
      user_id: 'user1'
    });

    const classification = classifier.classify(obj);

    expect(classification.type).toBe(OBJECTIVE_TYPES.ANALYZE_DATA);
  });

  test('should classify media generation objective', () => {
    const obj = new Objective({
      description: 'Generate a promotional video with voice narration',
      user_id: 'user1'
    });

    const classification = classifier.classify(obj);

    expect(classification.type).toBe(OBJECTIVE_TYPES.GENERATE_MEDIA);
  });

  test('should classify automation objective', () => {
    const obj = new Objective({
      description: 'Automate customer support workflow',
      user_id: 'user1'
    });

    const classification = classifier.classify(obj);

    expect(classification.type).toBe(OBJECTIVE_TYPES.AUTOMATE_WORKFLOW);
  });

  test('should classify consultation objective', () => {
    const obj = new Objective({
      description: 'Get advice on best practices for API design',
      user_id: 'user1'
    });

    const classification = classifier.classify(obj);

    expect(classification.type).toBe(OBJECTIVE_TYPES.PROVIDE_CONSULTATION);
  });

  test('should classify integration objective', () => {
    const obj = new Objective({
      description: 'Integrate our system with third-party API',
      user_id: 'user1'
    });

    const classification = classifier.classify(obj);

    expect(classification.type).toBe(OBJECTIVE_TYPES.INTEGRATE_SYSTEM);
  });

  test('should suggest agents for objective type', () => {
    const agents = classifier.suggestAgents(OBJECTIVE_TYPES.CREATE_CONTENT);

    expect(agents).toBeDefined();
    expect(agents.length).toBeGreaterThan(0);
    expect(agents[0]).toBe('DD'); // Delta (documents)
  });

  test('should extract entities from objective', () => {
    const obj = new Objective({
      description: 'Create a markdown guide for API development in 2 days',
      user_id: 'user1'
    });

    const entities = classifier.extractEntities(obj);

    expect(entities.resources).toContain('content');
    expect(entities.formats).toContain('markdown');
    expect(entities.constraints.length).toBeGreaterThan(0);
  });

  test('should extract media entities', () => {
    const obj = new Objective({
      description: 'Generate a CSV report with visualizations',
      user_id: 'user1'
    });

    const entities = classifier.extractEntities(obj);

    expect(entities.formats).toContain('csv');
  });

  test('should handle ambiguous objectives', () => {
    const obj = new Objective({
      description: 'Do something with the data',
      user_id: 'user1'
    });

    const classification = classifier.classify(obj);

    expect(classification.type).toBeDefined();
    // Should default to OTHER or closest match
  });
});
