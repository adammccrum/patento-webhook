'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const { makeAdapter, ctx, projectRecord, cleanup } = require('./helpers/harness');

test.after(cleanup);

test('provenance survives a write -> read round trip', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  const { id } = await adapter.write(
    projectRecord({
      kind: 'decision',
      content: 'Memory fails closed; no fallback to a secondary store.',
      provenance: {
        source: 'user',
        author_id: 'user_adam',
        origin: 'conversation:stack-review',
        captured_by: 'agent_quebec',
        evidence_uri: 'audit://event/0192',
        confidence: 0.9
      }
    }),
    context
  );

  const [record] = await adapter.read({ scope: 'project', id }, context);

  assert.equal(record.provenance.source, 'user');
  assert.equal(record.provenance.author_id, 'user_adam');
  assert.equal(record.provenance.origin, 'conversation:stack-review');
  assert.equal(record.provenance.captured_by, 'agent_quebec');
  assert.equal(record.provenance.evidence_uri, 'audit://event/0192');
  assert.equal(record.provenance.confidence, 0.9);
  assert.ok(record.provenance.captured_at, 'captured_at must be populated');
  assert.ok(record.audit_event_id, 'the record must reference its audit event');
});

test('provenance survives a restart — it is persisted, not held in memory', async () => {
  const { adapter, memoryPath } = await makeAdapter();
  const context = ctx();

  const { id } = await adapter.write(
    projectRecord({ kind: 'constraint', provenance: { source: 'document', author_id: 'user_adam', origin: 'docs/ARCHITECTURE.md#L12' } }),
    context
  );

  const { LocalMemoryAdapter } = require('../../src/providers/adapters/memory/local-memory-adapter');
  const { InMemoryAuditSink } = require('../../src/providers/adapters/memory/audit-sink');
  const reopened = new LocalMemoryAdapter({ path: memoryPath, auditSink: new InMemoryAuditSink() });
  await reopened.init();

  const [record] = await reopened.read({ scope: 'project', id }, context);
  assert.equal(record.provenance.origin, 'docs/ARCHITECTURE.md#L12');
  assert.equal(record.provenance.source, 'document');
});

test('getProvenance returns the full revision chain', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  const first = await adapter.write(
    projectRecord({ content: 'Default memory store is SQLite.' }),
    context
  );
  const second = await adapter.correct(
    first.id,
    {
      content: 'Default memory store is an append-only JSONL journal.',
      reason: 'Corrected after implementation review',
      provenance: { source: 'user', author_id: 'user_adam', origin: 'conversation:review' }
    },
    context
  );

  const { chain } = await adapter.getProvenance(second.id, context);

  assert.equal(chain.length, 2);
  assert.equal(chain[0].revision, 2);
  assert.equal(chain[0].content, 'Default memory store is an append-only JSONL journal.');
  assert.equal(chain[1].revision, 1);
  assert.equal(chain[1].content, 'Default memory store is SQLite.');
  assert.equal(chain[1].superseded_by, second.id, 'the superseded record must point at its successor');
});

test('export is machine-readable and preserves provenance', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  await adapter.write(projectRecord({ subject: 'subject_a' }), context);
  await adapter.write(projectRecord({ subject: 'subject_a', content: 'second fact' }), context);
  await adapter.write(projectRecord({ subject: 'subject_b' }), context);

  const dump = await adapter.export('subject_a', context);

  assert.equal(dump.format, 'memory-export/v1');
  assert.equal(dump.subject, 'subject_a');
  assert.equal(dump.records.length, 2);
  for (const record of dump.records) {
    assert.equal(record.subject, 'subject_a');
    assert.ok(record.provenance.source);
    assert.ok(record.provenance.author_id);
  }
});

test('export output is portable — another adapter can ingest it without losing provenance', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  await adapter.write(
    projectRecord({
      subject: 'subject_a',
      kind: 'decision',
      content: 'Reject the reverse-proxy integration mode.',
      provenance: { source: 'user', author_id: 'user_adam', origin: 'conversation:stack-review' }
    }),
    context
  );

  const dump = await adapter.export('subject_a', context);

  // Round-trip through JSON the way a different engine would receive it.
  const wire = JSON.parse(JSON.stringify(dump));
  const { adapter: target } = await makeAdapter();

  for (const record of wire.records) {
    await target.write(
      {
        scope: record.scope,
        kind: record.kind,
        subject: record.subject,
        content: record.content,
        sensitivity: record.sensitivity,
        provenance: record.provenance,
        reason: 'import from memory-export/v1'
      },
      context
    );
  }

  const imported = await target.read({ scope: 'project', subject: 'subject_a' }, context);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].provenance.author_id, 'user_adam');
  assert.equal(imported[0].provenance.origin, 'conversation:stack-review');
  assert.equal(imported[0].kind, 'decision');
});

test('the audit trail is written to its own sink, separate from the memory journal', async () => {
  const { adapter, audit, memoryPath } = await makeAdapter();
  const context = ctx();

  await adapter.write(projectRecord(), context);

  const journal = fs.readFileSync(memoryPath, 'utf8');
  assert.ok(journal.includes('"op":"write"'));

  const events = await audit.readAll();
  assert.equal(events.length, 1);
  assert.equal(events[0].action, 'memory.write');
});
