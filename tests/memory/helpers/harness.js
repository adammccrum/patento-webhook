'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { LocalMemoryAdapter } = require('../../../src/providers/adapters/memory/local-memory-adapter');
const { InMemoryAuditSink } = require('../../../src/providers/adapters/memory/audit-sink');
const MemoryAdapter = require('../../../src/providers/adapters/memory/memory-adapter-base');

const tempDirs = [];

function tempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'memtest-'));
  tempDirs.push(dir);
  return dir;
}

function cleanup() {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Consent registry that accepts a fixed set of refs. */
class StubConsentRegistry {
  constructor(active = []) {
    this.active = new Set(active);
  }

  async isActive(consentRef) {
    return this.active.has(consentRef);
  }

  revoke(consentRef) {
    this.active.delete(consentRef);
  }
}

/**
 * Build a LocalMemoryAdapter backed by a throwaway directory.
 * `clock` lets expiry be tested without sleeping.
 */
async function makeAdapter(options = {}) {
  const dir = tempDir();
  const clock = { now: options.startTime || Date.parse('2026-08-08T09:00:00Z') };
  const audit = new InMemoryAuditSink();

  const adapter = new LocalMemoryAdapter({
    path: path.join(dir, 'memory.jsonl'),
    auditSink: audit,
    consentRegistry: options.consentRegistry || new StubConsentRegistry(),
    now: () => clock.now,
    ...options.adapterConfig
  });

  await adapter.init();
  return { adapter, audit, clock, dir, memoryPath: path.join(dir, 'memory.jsonl') };
}

function ctx(overrides = {}) {
  return {
    actor: { id: 'agent_quebec', type: 'agent' },
    correlation_id: 'corr_test_1',
    permissions: ['memory:*'],
    ...overrides
  };
}

/** A minimal valid project-scope record. */
function projectRecord(overrides = {}) {
  return {
    scope: 'project',
    kind: 'fact',
    subject: 'patento-webhook',
    content: 'The provider registry lists adapters by category.',
    reason: 'test fixture',
    provenance: { source: 'agent', author_id: 'agent_quebec', origin: 'conversation:test' },
    ...overrides
  };
}

/**
 * Stand-in for a future external engine adapter. Exists only so the egress
 * gate and fail-closed rules can be tested. No vendor SDK, no network.
 */
class StubExternalAdapter extends MemoryAdapter {
  constructor(config = {}) {
    super({ id: config.id || 'stub-external', name: 'Stub External', ...config });
    this.external = true;
    this.allow_egress = config.allow_egress === true;
    this.allowed_scopes = config.allowed_scopes || [];
    this.declared_destinations = config.declared_destinations || null;
    this.health = config.health || 'healthy';
    this.received = [];
    this.shouldThrow = false;
  }

  async healthCheck() {
    return this.health;
  }

  async write(record, context) {
    if (this.shouldThrow) throw new Error('external engine exploded');
    this.received.push({ record, context });
    return { id: 'ext_1', audit_event_id: 'ext_audit_1' };
  }

  async purgeSubject(subjectId) {
    this.received = this.received.filter((r) => r.record.subject !== subjectId);
    return { subject: subjectId, erased: 0 };
  }
}

module.exports = {
  makeAdapter,
  ctx,
  projectRecord,
  cleanup,
  tempDir,
  StubConsentRegistry,
  StubExternalAdapter
};
