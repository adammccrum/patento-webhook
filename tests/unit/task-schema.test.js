const { Subtask, Task, Objective, TASK_STATES, OBJECTIVE_TYPES } = require('../../src/orchestration/task-schema');

describe('Task Schema', () => {
  describe('Subtask', () => {
    test('should create a subtask', () => {
      const subtask = new Subtask({
        title: 'Test Subtask',
        description: 'A test subtask',
        agent_code: 'AA',
        capability_required: 'test'
      });

      expect(subtask.title).toBe('Test Subtask');
      expect(subtask.state).toBe(TASK_STATES.PENDING);
      expect(subtask.retry_count).toBe(0);
    });

    test('should validate subtask data', () => {
      const validation = Subtask.validate({
        title: 'Test',
        description: 'Test desc',
        agent_code: 'BB',
        capability_required: 'capability'
      });

      expect(validation.valid).toBe(true);
    });

    test('should fail validation with missing fields', () => {
      const validation = Subtask.validate({
        title: 'Test'
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    test('should track execution state', () => {
      const subtask = new Subtask({
        title: 'Test',
        description: 'Desc',
        agent_code: 'CC',
        capability_required: 'work'
      });

      subtask.setExecuting();
      expect(subtask.state).toBe(TASK_STATES.EXECUTING);
      expect(subtask.started_at).toBeDefined();

      subtask.setCompleted({ result: 'done' });
      expect(subtask.state).toBe(TASK_STATES.COMPLETED);
      expect(subtask.output).toEqual({ result: 'done' });
    });

    test('should handle retries', () => {
      const subtask = new Subtask({
        title: 'Test',
        description: 'Desc',
        agent_code: 'DD',
        capability_required: 'work',
        max_retries: 3
      });

      expect(subtask.canRetry()).toBe(true);

      subtask.setRetrying();
      expect(subtask.retry_count).toBe(1);
      expect(subtask.state).toBe(TASK_STATES.RETRYING);

      subtask.setRetrying();
      expect(subtask.retry_count).toBe(2);

      subtask.setRetrying();
      expect(subtask.retry_count).toBe(3);

      expect(subtask.canRetry()).toBe(false);
    });

    test('should serialize to JSON', () => {
      const subtask = new Subtask({
        title: 'Test',
        description: 'Desc',
        agent_code: 'EE',
        capability_required: 'work'
      });

      const json = subtask.toJSON();
      expect(json.title).toBe('Test');
      expect(json.state).toBe(TASK_STATES.PENDING);
    });
  });

  describe('Task', () => {
    test('should create a task', () => {
      const task = new Task({
        title: 'Test Task',
        description: 'A test task',
        user_id: 'user123'
      });

      expect(task.title).toBe('Test Task');
      expect(task.subtasks.length).toBe(0);
    });

    test('should add subtasks', () => {
      const task = new Task({
        title: 'Test',
        description: 'Desc',
        user_id: 'user'
      });

      task.addSubtask({
        title: 'Sub1',
        description: 'Sub desc',
        agent_code: 'FF',
        capability_required: 'work'
      });

      expect(task.subtasks.length).toBe(1);
    });

    test('should track subtask dependencies', () => {
      const task = new Task({
        title: 'Test',
        description: 'Desc',
        user_id: 'user'
      });

      const sub1 = task.addSubtask({
        title: 'First',
        description: 'First',
        agent_code: 'GG',
        capability_required: 'work'
      });

      const sub2 = task.addSubtask({
        title: 'Second',
        description: 'Depends on first',
        agent_code: 'HH',
        capability_required: 'work',
        dependencies: [sub1.id]
      });

      // Only sub1 is ready
      let ready = task.getReadySubtasks();
      expect(ready.length).toBe(1);
      expect(ready[0].id).toBe(sub1.id);

      // After sub1 completes, sub2 is ready
      sub1.setCompleted({ result: 'done' });
      ready = task.getReadySubtasks();
      expect(ready.length).toBe(1);
      expect(ready[0].id).toBe(sub2.id);
    });

    test('should detect task completion', () => {
      const task = new Task({
        title: 'Test',
        description: 'Desc',
        user_id: 'user'
      });

      const sub1 = task.addSubtask({
        title: 'Work',
        description: 'Work',
        agent_code: 'II',
        capability_required: 'work'
      });

      expect(task.isComplete()).toBe(false);

      sub1.setCompleted({ result: 'done' });
      expect(task.isComplete()).toBe(true);
    });

    test('should detect task failure', () => {
      const task = new Task({
        title: 'Test',
        description: 'Desc',
        user_id: 'user'
      });

      const sub1 = task.addSubtask({
        title: 'Work',
        description: 'Work',
        agent_code: 'JJ',
        capability_required: 'work',
        max_retries: 0
      });

      expect(task.hasFailed()).toBe(false);

      sub1.setFailed('Error');
      expect(task.hasFailed()).toBe(true);
    });

    test('should get subtasks by state', () => {
      const task = new Task({
        title: 'Test',
        description: 'Desc',
        user_id: 'user'
      });

      const sub1 = task.addSubtask({
        title: 'Work1',
        description: 'Work',
        agent_code: 'KK',
        capability_required: 'work'
      });

      const sub2 = task.addSubtask({
        title: 'Work2',
        description: 'Work',
        agent_code: 'LL',
        capability_required: 'work'
      });

      sub1.setCompleted({ result: 'done' });

      const completed = task.getSubtasksByState(TASK_STATES.COMPLETED);
      expect(completed.length).toBe(1);

      const pending = task.getSubtasksByState(TASK_STATES.PENDING);
      expect(pending.length).toBe(1);
    });
  });

  describe('Objective', () => {
    test('should create an objective', () => {
      const obj = new Objective({
        user_id: 'user123',
        description: 'Create something',
        type: OBJECTIVE_TYPES.CREATE_CONTENT
      });

      expect(obj.description).toBe('Create something');
      expect(obj.type).toBe(OBJECTIVE_TYPES.CREATE_CONTENT);
    });

    test('should serialize to JSON', () => {
      const obj = new Objective({
        user_id: 'user',
        description: 'Test',
        context: { key: 'value' }
      });

      const json = obj.toJSON();
      expect(json.description).toBe('Test');
      expect(json.context.key).toBe('value');
    });
  });
});
