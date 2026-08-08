'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const { makeAdapter, ctx, projectRecord, cleanup, StubConsentRegistry } = require('./helpers/harness');
const { NotFoundError } = require('../../src/providers/adapters/memory/memory-errors');

test.after(cleanup);

test('correction supersedes rather than overwrites', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  const original = await adapter.write(
    projectRecord({ content: 'Node 20 is the minimum version.' }),
    context
  );
  const corrected = await adapter.correct(
    original.id,
    {
      content: 'Node 22 is the minimum version.',
      reason: 'Corrected after checking package.json',
      provenance: { source: 'user', author_id: 'user_adam', origin: 'package.json' }
    },
    context
  );

  assert.notEqual(corrected.id, original.id, 'a correction creates a new record');
  assert.equal(corrected.revision, 2);

  // The live view shows only the correction.
  const live = await adapter.read({ scope: 'project' }, context);
  assert.equal(live.length, 1);
  assert.equal(live[0].content, 'Node 22 is the minimum version.');

  // The original still exists, marked superseded — what the system used to
  // believe survives.
  const { chain } = await adapter.getProvenance(corrected.id, context);
  assert.equal(chain.length, 2);
  assert.equal(chain[1].content, 'Node 20 is the minimum version.');
});

test('a superseded record is no longer returned by read', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  const original = await adapter.write(projectRecord({ content: 'stale' }), context);
  await adapter.correct(
    original.id,
    { content: 'fresh', reason: 'update', provenance: { source: 'agent', author_id: 'agent_quebec' } },
    context
  );

  const byId = await adapter.read({ scope: 'project', id: original.id }, context);
  assert.equal(byId.length, 0);
});

test('correcting an already-corrected record chains revisions', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  const v1 = await adapter.write(projectRecord({ content: 'v1' }), context);
  const v2 = await adapter.correct(
    v1.id,
    { content: 'v2', reason: 'r', provenance: { source: 'agent', author_id: 'agent_quebec' } },
    context
  );
  const v3 = await adapter.correct(
    v2.id,
    { content: 'v3', reason: 'r', provenance: { source: 'agent', author_id: 'agent_quebec' } },
    context
  );

  assert.equal(v3.revision, 3);
  const { chain } = await adapter.getProvenance(v3.id, context);
  assert.deepEqual(chain.map((c) => c.content), ['v3', 'v2', 'v1']);
});

test('soft delete hides the memory but retains the record', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  const { id } = await adapter.write(projectRecord(), context);
  await adapter.delete(id, { reason: 'no longer relevant' }, context);

  const live = await adapter.read({ scope: 'project' }, context);
  assert.equal(live.length, 0);

  const provenance = await adapter.getProvenance(id, context);
  assert.equal(provenance.chain.length, 1, 'soft delete keeps the record for audit');
});

test('hard delete physically removes content from the journal', async () => {
  const { adapter, memoryPath } = await makeAdapter();
  const context = ctx();

  const secret = 'PATIENT-RECORD-XYZ-9981';
  const { id } = await adapter.write(projectRecord({ content: secret }), context);

  assert.ok(fs.readFileSync(memoryPath, 'utf8').includes(secret), 'precondition: content on disk');

  await adapter.delete(id, { hard: true, reason: 'erasure request' }, context);

  const onDisk = fs.readFileSync(memoryPath, 'utf8');
  assert.ok(!onDisk.includes(secret), 'hard delete must remove the content from disk');
  await assert.rejects(() => adapter.getProvenance(id, context), NotFoundError);
});

test('purgeSubject erases every record for a subject, including superseded ones', async () => {
  const { adapter, memoryPath } = await makeAdapter();
  const context = ctx();

  const oldSecret = 'LEARNER-NOTE-OLD-111';
  const newSecret = 'LEARNER-NOTE-NEW-222';
  const unrelated = 'UNRELATED-CONTENT-333';

  const v1 = await adapter.write(
    projectRecord({ subject: 'learner_42', content: oldSecret }),
    context
  );
  await adapter.correct(
    v1.id,
    { content: newSecret, reason: 'update', provenance: { source: 'agent', author_id: 'agent_quebec' } },
    context
  );
  await adapter.write(projectRecord({ subject: 'other_subject', content: unrelated }), context);

  const result = await adapter.purgeSubject('learner_42', context);
  assert.equal(result.erased, 2, 'both the original and the correction must be erased');

  const onDisk = fs.readFileSync(memoryPath, 'utf8');
  assert.ok(!onDisk.includes(oldSecret), 'a superseded record must not outlive an erasure request');
  assert.ok(!onDisk.includes(newSecret));
  assert.ok(onDisk.includes(unrelated), 'other subjects are untouched');

  const remaining = await adapter.read({ scope: 'project' }, context);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].subject, 'other_subject');
});

test('purgeSubject leaves a contentless tombstone so the erasure itself is auditable', async () => {
  const { adapter, audit, memoryPath } = await makeAdapter();
  const context = ctx();

  await adapter.write(projectRecord({ subject: 'learner_42', content: 'SENSITIVE-AAA' }), context);
  await adapter.purgeSubject('learner_42', context);

  const journal = fs
    .readFileSync(memoryPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const tombstone = journal.find((e) => e.op === 'erased');
  assert.ok(tombstone, 'an erasure tombstone must remain');
  assert.equal(tombstone.subject, 'learner_42');
  assert.ok(!JSON.stringify(tombstone).includes('SENSITIVE-AAA'), 'the tombstone carries no content');

  const events = await audit.readAll();
  assert.ok(events.some((e) => e.action === 'memory.purge_subject'));
});

test('erasure survives a restart', async () => {
  const { adapter, memoryPath } = await makeAdapter();
  const context = ctx();

  await adapter.write(projectRecord({ subject: 'learner_42', content: 'GONE-FOREVER' }), context);
  await adapter.purgeSubject('learner_42', context);

  const { LocalMemoryAdapter } = require('../../src/providers/adapters/memory/local-memory-adapter');
  const { InMemoryAuditSink } = require('../../src/providers/adapters/memory/audit-sink');
  const reopened = new LocalMemoryAdapter({ path: memoryPath, auditSink: new InMemoryAuditSink() });
  await reopened.init();

  const records = await reopened.read({ scope: 'project' }, context);
  assert.equal(records.length, 0);
});

test('expired memory is not returned by read', async () => {
  const { adapter, clock } = await makeAdapter();
  const context = ctx();

  const expiresAt = new Date(clock.now + 60 * 1000).toISOString();
  await adapter.write(
    projectRecord({ lifecycle: { expires_at: expiresAt } }),
    context
  );

  assert.equal((await adapter.read({ scope: 'project' }, context)).length, 1);

  clock.now += 61 * 1000;
  assert.equal(
    (await adapter.read({ scope: 'project' }, context)).length,
    0,
    'memory past its expiry must not be recalled'
  );
});

test('expiry can be set and changed after the fact', async () => {
  const { adapter, clock } = await makeAdapter();
  const context = ctx();

  const { id } = await adapter.write(projectRecord(), context);
  const expiresAt = new Date(clock.now + 5 * 60 * 1000).toISOString();
  await adapter.expire(id, expiresAt, context);

  const [record] = await adapter.read({ scope: 'project', id }, context);
  assert.equal(record.expires_at, expiresAt);

  clock.now += 6 * 60 * 1000;
  assert.equal((await adapter.read({ scope: 'project' }, context)).length, 0);
});

test('sweepExpired physically removes expired content', async () => {
  const { adapter, clock, memoryPath } = await makeAdapter();
  const context = ctx();

  const secret = 'EXPIRING-CONTENT-777';
  await adapter.write(
    projectRecord({
      content: secret,
      lifecycle: { expires_at: new Date(clock.now + 60 * 1000).toISOString() }
    }),
    context
  );

  clock.now += 61 * 1000;
  const result = await adapter.sweepExpired(context);
  assert.equal(result.erased, 1);
  assert.ok(!fs.readFileSync(memoryPath, 'utf8').includes(secret));
});

test('revoking consent then purging removes learner memory end to end', async () => {
  const consent = new StubConsentRegistry(['consent_1']);
  const { adapter, clock, memoryPath } = await makeAdapter({ consentRegistry: consent });
  const context = ctx();
  const expires = new Date(clock.now + 30 * 24 * 60 * 60 * 1000).toISOString();

  const record = projectRecord({
    scope: 'learner',
    subject: 'learner_42',
    consent_ref: 'consent_1',
    content: 'LEARNER-PII-555',
    lifecycle: { expires_at: expires }
  });

  const proposal = await adapter.propose(record, context);
  const approved = ctx({
    approval: { proposal_id: proposal.proposal_id, approved_by: 'user_adam' }
  });
  await adapter.write(record, approved);

  consent.revoke('consent_1');
  await adapter.purgeSubject('learner_42', context);

  assert.ok(!fs.readFileSync(memoryPath, 'utf8').includes('LEARNER-PII-555'));
  assert.equal((await adapter.read({ scope: 'learner' }, context)).length, 0);
});
