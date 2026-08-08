'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeAdapter, ctx, projectRecord, cleanup } = require('./helpers/harness');
const {
  ValidationError,
  ProvenanceRequiredError,
  ApprovalRequiredError,
  AuditWriteError,
  ContextRequiredError
} = require('../../src/providers/adapters/memory/memory-errors');

test.after(cleanup);

test('explicit writes only: nothing is stored without a write() call', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  // Reads, searches and provenance lookups must never cause a write.
  await adapter.read({ scope: 'project' }, context);
  await adapter.search({ scope: 'project', text: 'anything' }, context);

  const stored = await adapter.read({ scopes: ['project', 'session', 'operational'] }, context);
  assert.equal(stored.length, 0, 'no memory may appear without an explicit write');
});

test('explicit writes only: a write must state a reason', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  const noReason = projectRecord();
  delete noReason.reason;

  await assert.rejects(() => adapter.write(noReason, context), ValidationError);
});

test('every operation requires a caller context', async () => {
  const { adapter } = await makeAdapter();

  await assert.rejects(() => adapter.write(projectRecord(), undefined), ContextRequiredError);
  await assert.rejects(() => adapter.write(projectRecord(), {}), ContextRequiredError);
  await assert.rejects(
    () => adapter.write(projectRecord(), { actor: { id: 'x' } }),
    ContextRequiredError,
    'correlation_id is required so the write can be tied to an audit trail'
  );
});

test('every write emits an audit event before it is acknowledged', async () => {
  const { adapter, audit } = await makeAdapter();
  const context = ctx();

  const { id, audit_event_id } = await adapter.write(
    projectRecord({ reason: 'Recording architecture decision from PR #42' }),
    context
  );

  const events = await audit.readAll();
  assert.equal(events.length, 1);
  assert.equal(events[0].action, 'memory.write');
  assert.equal(events[0].memory_id, id);
  assert.equal(events[0].actor, 'agent_quebec');
  assert.equal(events[0].correlation_id, 'corr_test_1');
  assert.equal(events[0].reason, 'Recording architecture decision from PR #42');
  assert.equal(events[0].audit_event_id, audit_event_id);
});

test('a failed audit write means a failed memory write', async () => {
  const { adapter, audit } = await makeAdapter();
  const context = ctx();

  audit.failNext = true;
  await assert.rejects(() => adapter.write(projectRecord(), context), AuditWriteError);

  const stored = await adapter.read({ scope: 'project' }, context);
  assert.equal(stored.length, 0, 'an unauditable write must not be persisted');
});

test('decisions and constraints are rejected without provenance origin', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  await assert.rejects(
    () =>
      adapter.write(
        projectRecord({
          kind: 'decision',
          provenance: { source: 'agent', author_id: 'agent_quebec' }
        }),
        context
      ),
    ProvenanceRequiredError
  );

  await assert.rejects(
    () =>
      adapter.write(
        projectRecord({
          kind: 'constraint',
          provenance: { source: 'agent', author_id: 'agent_quebec' }
        }),
        context
      ),
    ProvenanceRequiredError
  );
});

test('provenance is mandatory on every write, whatever the kind', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  const noProvenance = projectRecord();
  delete noProvenance.provenance;

  await assert.rejects(() => adapter.write(noProvenance, context), ProvenanceRequiredError);
});

test('restricted writes require an approved proposal', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  await assert.rejects(
    () => adapter.write(projectRecord({ sensitivity: 'restricted' }), context),
    ApprovalRequiredError
  );
});

test('a proposal cannot be approved by its own proposer', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  const record = projectRecord({ sensitivity: 'restricted' });
  const proposal = await adapter.propose(record, context);

  const selfApproved = ctx({
    approval: { proposal_id: proposal.proposal_id, approved_by: 'agent_quebec' }
  });

  await assert.rejects(() => adapter.write(record, selfApproved), ApprovalRequiredError);
});

test('an approval cannot be reused for different content', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  const proposal = await adapter.propose(
    projectRecord({ sensitivity: 'restricted', content: 'approved content' }),
    context
  );
  const approved = ctx({
    approval: { proposal_id: proposal.proposal_id, approved_by: 'user_adam' }
  });

  await assert.rejects(
    () =>
      adapter.write(
        projectRecord({ sensitivity: 'restricted', content: 'swapped content' }),
        approved
      ),
    ApprovalRequiredError,
    'the approved content hash must match what is actually written'
  );
});

test('an approval is single-use', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  const record = projectRecord({ sensitivity: 'restricted', content: 'approved once' });
  const proposal = await adapter.propose(record, context);
  const approved = ctx({
    approval: { proposal_id: proposal.proposal_id, approved_by: 'user_adam' }
  });

  await adapter.write(record, approved);
  await assert.rejects(() => adapter.write(record, approved), ApprovalRequiredError);
});

test('propose() does not store the memory', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  await adapter.propose(projectRecord({ sensitivity: 'restricted' }), context);

  const stored = await adapter.read({ scope: 'project' }, context);
  assert.equal(stored.length, 0, 'a proposal is not a write');
});

test('reads of restricted memory are themselves audited', async () => {
  const { adapter, audit } = await makeAdapter();
  const context = ctx();

  const record = projectRecord({ sensitivity: 'restricted' });
  const proposal = await adapter.propose(record, context);
  const approved = ctx({
    approval: { proposal_id: proposal.proposal_id, approved_by: 'user_adam' }
  });
  await adapter.write(record, approved);

  await adapter.read({ scope: 'project' }, context);

  const reads = (await audit.readAll()).filter((e) => e.action === 'memory.read.restricted');
  assert.equal(reads.length, 1);
});

test('trust level cannot be asserted by the writer', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  await assert.rejects(
    () => adapter.write(projectRecord({ trust: { level: 'human_confirmed' } }), context),
    ValidationError,
    'a writer must not be able to declare its own memory verified'
  );
});

test('trust is raised only by someone other than the author', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  const { id } = await adapter.write(projectRecord(), context);

  await assert.rejects(
    () => adapter.verify(id, { level: 'human_confirmed', verified_by: 'agent_quebec' }, context),
    ValidationError
  );

  const result = await adapter.verify(
    id,
    { level: 'human_confirmed', verified_by: 'user_adam' },
    context
  );
  assert.equal(result.trust_level, 'human_confirmed');

  const [record] = await adapter.read({ scope: 'project', id }, context);
  assert.equal(record.trust.level, 'human_confirmed');
  assert.equal(record.trust.verified_by, 'user_adam');
});
