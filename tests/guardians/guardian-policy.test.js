/**
 * Guardian Policy Tests
 */

const GuardianPolicy = require('../../src/guardians/guardian-policy');
const GuardianContext = require('../../src/guardians/guardian-context');

describe('GuardianPolicy', () => {
  let policy;

  beforeEach(() => {
    policy = new GuardianPolicy({
      policies: [
        {
          name: 'high_risk_execution',
          priority: 100,
          action: ['shell_command', 'execute_code'],
          required_guardians: ['execution', 'audit'],
          optional_guardians: ['secrets'],
          fail_mode: 'fail_closed'
        },
        {
          name: 'network_operations',
          priority: 90,
          action: ['fetch_url', 'api_call'],
          requires_network: true,
          required_guardians: ['network', 'audit'],
          optional_guardians: [],
          fail_mode: 'fail_closed'
        },
        {
          name: 'sensitive_data',
          priority: 80,
          data_classification: ['confidential', 'restricted'],
          required_guardians: ['compliance', 'audit'],
          optional_guardians: [],
          fail_mode: 'hold_for_review'
        }
      ]
    });
  });

  describe('Policy Matching', () => {
    it('matches policy by action', () => {
      const context = new GuardianContext({
        action: 'shell_command'
      });

      const result = policy.getRequiredGuardians(context);
      expect(result.required).toContain('execution');
      expect(result.required).toContain('audit');
    });

    it('matches policy by data classification', () => {
      const context = new GuardianContext({
        action: 'data_read',
        privacy_classification: 'confidential'
      });

      const result = policy.getRequiredGuardians(context);
      expect(result.required).toContain('compliance');
    });

    it('respects priority for overlapping policies', () => {
      policy.addPolicy({
        name: 'super_high_risk',
        priority: 200,
        action: ['shell_command'],
        required_guardians: ['execution', 'compliance', 'audit'],
        fail_mode: 'fail_closed'
      });

      const context = new GuardianContext({
        action: 'shell_command'
      });

      const result = policy.getRequiredGuardians(context);
      expect(result.reason).toBe('super_high_risk');
    });

    it('falls back to default policy when no match', () => {
      const context = new GuardianContext({
        action: 'unknown_action'
      });

      const result = policy.getRequiredGuardians(context);
      expect(result.required).toContain('audit');
    });
  });

  describe('Guardian Requirements', () => {
    it('identifies required Guardian', () => {
      const context = new GuardianContext({
        action: 'shell_command'
      });

      expect(policy.isGuardianRequired('execution', context)).toBe(true);
      expect(policy.isGuardianRequired('network', context)).toBe(false);
    });

    it('identifies optional Guardian', () => {
      const context = new GuardianContext({
        action: 'shell_command'
      });

      expect(policy.isGuardianOptional('secrets', context)).toBe(true);
      expect(policy.isGuardianOptional('network', context)).toBe(false);
    });
  });

  describe('Policy Management', () => {
    it('adds new policy', () => {
      const before = policy.getPolicies().length;
      policy.addPolicy({
        name: 'test_policy',
        priority: 50,
        required_guardians: ['test']
      });

      expect(policy.getPolicies().length).toBe(before + 1);
    });

    it('rejects policy without name', () => {
      expect(() => {
        policy.addPolicy({
          required_guardians: ['test']
        });
      }).toThrow();
    });

    it('removes policy by name', () => {
      const before = policy.getPolicies().length;
      policy.removePolicy('network_operations');
      expect(policy.getPolicies().length).toBe(before - 1);
    });

    it('gets all policies', () => {
      const policies = policy.getPolicies();
      expect(Array.isArray(policies)).toBe(true);
      expect(policies.length).toBeGreaterThan(0);
    });
  });

  describe('Policy Explanation', () => {
    it('explains which policy matches', () => {
      const context = new GuardianContext({
        action: 'shell_command'
      });

      const explanation = policy.explainPolicy(context);
      expect(explanation.policy_name).toBe('high_risk_execution');
      expect(explanation.required_guardians).toContain('execution');
    });

    it('explains default policy', () => {
      const context = new GuardianContext({
        action: 'unknown'
      });

      const explanation = policy.explainPolicy(context);
      expect(explanation.policy_name).toBe('default_policy');
    });
  });

  describe('Complex Matching', () => {
    beforeEach(() => {
      policy.addPolicy({
        name: 'complex_rule',
        priority: 150,
        action: ['data_process'],
        risk_level: ['high'],
        requires_network: true,
        required_guardians: ['network', 'execution', 'compliance'],
        fail_mode: 'hold_for_authorisation'
      });
    });

    it('matches on multiple criteria', () => {
      const context = new GuardianContext({
        action: 'data_process',
        risk_classification: 'high',
        network_destinations: ['https://api.example.com']
      });

      const result = policy.getRequiredGuardians(context);
      expect(result.required).toContain('network');
      expect(result.required).toContain('execution');
    });

    it('requires all criteria to match', () => {
      const context = new GuardianContext({
        action: 'data_process',
        risk_classification: 'low' // Doesn't match 'high'
      });

      const result = policy.getRequiredGuardians(context);
      expect(result.reason).not.toBe('complex_rule');
    });
  });

  describe('Fail Modes', () => {
    it('returns fail_mode for policy', () => {
      const context = new GuardianContext({
        action: 'shell_command'
      });

      const result = policy.getRequiredGuardians(context);
      expect(result.fail_mode).toBe('fail_closed');
    });

    it('returns default fail_mode', () => {
      const context = new GuardianContext({
        action: 'unknown'
      });

      const result = policy.getRequiredGuardians(context);
      expect(result.fail_mode).toBe('fail_closed');
    });
  });

  describe('Array vs String Matching', () => {
    beforeEach(() => {
      policy.addPolicy({
        name: 'multi_action',
        priority: 100,
        action: ['create', 'update', 'delete'],
        required_guardians: ['audit'],
        fail_mode: 'fail_closed'
      });
    });

    it('matches action in array', () => {
      const context = new GuardianContext({
        action: 'create'
      });

      const result = policy.getRequiredGuardians(context);
      expect(result.reason).toBe('multi_action');
    });

    it('matches when not in array', () => {
      const context = new GuardianContext({
        action: 'read'
      });

      const result = policy.getRequiredGuardians(context);
      expect(result.reason).not.toBe('multi_action');
    });
  });
});
