'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeAdapter,
  ctx,
  projectRecord,
  cleanup,
  StubConsentRegistry,
  StubExternalAdapter
} = require('./helpers/harness');
const { MemoryProvider } = require('../../src/providers/memory-provider');
const { EgressDeniedError, ValidationError } = require('../../src/providers/adapters/memory/memory-errors');

test.after(cleanup);

test('the local adapter performs no egress and declares itself local', async () => {
  const { adapter } = await makeAdapter();
  assert.equal(adapter.external, false);
  assert.equal(adapter.allow_egress, false);
});

test('a config that lets an external adapter hold learner memory is rejected at startup', async () => {
  const { adapter } = await makeAdapter();
  const external = new StubExternalAdapter({
    allow_egress: true,
    allowed_scopes: ['project', 'learner'],
    declared_destinations: ['http://127.0.0.1:8420']
  });

  assert.throws(
    () => new MemoryProvider({ adapters: [adapter, external] }),
    EgressDeniedError,
    'learner scope must be refused before the system can run, not at write time'
  );
});

test('an external adapter must declare its destinations before egress is permitted', async () => {
  const { adapter } = await makeAdapter();
  const external = new StubExternalAdapter({
    allow_egress: true,
    allowed_scopes: ['project']
  });

  assert.throws(() => new MemoryProvider({ adapters: [adapter, external] }), EgressDeniedError);
});

test('the default adapter must be local', async () => {
  const external = new StubExternalAdapter({ id: 'ext' });
  assert.throws(
    () => new MemoryProvider({ adapters: [external], defaultAdapterId: 'ext' }),
    EgressDeniedError
  );
});

test('a missing default adapter is a configuration error', async () => {
  const { adapter } = await makeAdapter();
  assert.throws(
    () => new MemoryProvider({ adapters: [adapter], defaultAdapterId: 'nope' }),
    ValidationError
  );
});

test('learner memory routes to the local adapter even when an external one is enabled', async () => {
  const consent = new StubConsentRegistry(['consent_1']);
  const { adapter, clock } = await makeAdapter({ consentRegistry: consent });
  const external = new StubExternalAdapter({
    allow_egress: true,
    allowed_scopes: ['project'],
    declared_destinations: ['http://127.0.0.1:8420']
  });
  const provider = new MemoryProvider({ adapters: [adapter, external] });

  assert.equal(provider.route({ scope: 'learner', sensitivity: 'internal' }).id, 'local-memory');

  const expires = new Date(clock.now + 30 * 24 * 60 * 60 * 1000).toISOString();
  const record = projectRecord({
    scope: 'learner',
    subject: 'learner_42',
    consent_ref: 'consent_1',
    content: 'LEARNER-ONLY-CONTENT',
    lifecycle: { expires_at: expires }
  });

  const context = ctx();
  const proposal = await adapter.propose(record, context);
  const approved = ctx({
    approval: { proposal_id: proposal.proposal_id, approved_by: 'user_adam' }
  });

  await provider.write(record, approved);

  assert.equal(external.received.length, 0, 'learner memory must never reach an external adapter');
  const stored = await adapter.read({ scope: 'learner' }, approved);
  assert.equal(stored.length, 1);
});

test('restricted and secret memory stay local regardless of scope routing', async () => {
  const { adapter } = await makeAdapter();
  const external = new StubExternalAdapter({
    allow_egress: true,
    allowed_scopes: ['project'],
    declared_destinations: ['http://127.0.0.1:8420']
  });
  const provider = new MemoryProvider({ adapters: [adapter, external] });

  assert.equal(provider.route({ scope: 'project', sensitivity: 'restricted' }).id, 'local-memory');
  assert.equal(provider.route({ scope: 'project', sensitivity: 'secret' }).id, 'local-memory');
  assert.equal(provider.route({ scope: 'project', sensitivity: 'internal' }).id, 'stub-external');
});

test('with egress off, everything stays local even for permitted scopes', async () => {
  const { adapter } = await makeAdapter();
  const external = new StubExternalAdapter({
    allow_egress: false,
    allowed_scopes: ['project'],
    declared_destinations: ['http://127.0.0.1:8420']
  });
  const provider = new MemoryProvider({ adapters: [adapter, external] });
  const context = ctx();

  await provider.write(projectRecord(), context);

  assert.equal(external.received.length, 0);
  assert.equal((await adapter.read({ scope: 'project' }, context)).length, 1);
});

test('a disabled external adapter is never routed to', async () => {
  const { adapter } = await makeAdapter();
  const external = new StubExternalAdapter({
    enabled: false,
    allow_egress: true,
    allowed_scopes: ['project'],
    declared_destinations: ['http://127.0.0.1:8420']
  });
  const provider = new MemoryProvider({ adapters: [adapter, external] });

  assert.equal(provider.route({ scope: 'project', sensitivity: 'internal' }).id, 'local-memory');
});

test('erasure fans out to every registered adapter', async () => {
  const { adapter } = await makeAdapter();
  const external = new StubExternalAdapter({
    allow_egress: true,
    allowed_scopes: ['project'],
    declared_destinations: ['http://127.0.0.1:8420']
  });
  const provider = new MemoryProvider({ adapters: [adapter, external] });
  const context = ctx();

  await provider.write(projectRecord({ subject: 'subject_a' }), context);
  external.received.push({ record: { subject: 'subject_a' } });

  await provider.purgeSubject('subject_a', context);

  assert.equal(external.received.length, 0, 'consent revocation must reach every adapter');
  assert.equal((await adapter.read({ scope: 'project' }, context)).length, 0);
});
