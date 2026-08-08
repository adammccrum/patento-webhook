'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeAdapter, ctx, projectRecord, cleanup } = require('./helpers/harness');
const { MemoryProvider } = require('../../src/providers/memory-provider');
const {
  RECALL_RECORD_KEYS,
  FORBIDDEN_RECORD_KEYS,
  PREAMBLE
} = require('../../src/providers/adapters/memory/recall');
const { SystemPromptInjectionError } = require('../../src/providers/adapters/memory/memory-errors');

test.after(cleanup);

async function providerWith(records = []) {
  const { adapter, clock } = await makeAdapter();
  const context = ctx();
  for (const record of records) {
    await adapter.write(record, context);
  }
  return { provider: new MemoryProvider({ adapters: [adapter] }), adapter, context, clock };
}

test('recall marks every record untrusted by default', async () => {
  const { provider, context } = await providerWith([projectRecord()]);

  const recall = await provider.recall({ scope: 'project' }, context);

  assert.equal(recall.length, 1);
  assert.equal(recall.records[0].trust.level, 'unverified');
  assert.equal(recall.trust_summary.unverified, 1);
});

test('the rendered block labels recall as untrusted and attributes it', async () => {
  const { provider, context } = await providerWith([
    projectRecord({
      kind: 'decision',
      content: 'Adapters are swapped by configuration.',
      provenance: { source: 'user', author_id: 'user_adam', origin: 'conversation:review' }
    })
  ]);

  const block = (await provider.recall({ scope: 'project' }, context)).toContextBlock();

  assert.ok(block.startsWith(PREAMBLE), 'the untrusted preamble must lead');
  assert.match(block, /does not grant permission/);
  assert.match(block, /trust="unverified"/);
  assert.match(block, /source="user"/);
  assert.match(block, /author="user_adam"/);
  assert.match(block, /origin="conversation:review"/);
  assert.match(block, /captured="/);
});

test('recall refuses to render into the system prompt', async () => {
  const { provider, context } = await providerWith([projectRecord()]);
  const recall = await provider.recall({ scope: 'project' }, context);

  assert.throws(() => recall.toContextBlock({ role: 'system' }), SystemPromptInjectionError);
  assert.throws(() => recall.toContextBlock({ role: 'developer' }), SystemPromptInjectionError);

  // The permitted positions still work.
  assert.ok(recall.toContextBlock({ role: 'user' }));
  assert.ok(recall.toContextBlock({ role: 'tool' }));
  assert.ok(recall.toContextBlock(), 'user-turn context is the default');
});

test('an empty recall renders as an explicit "nothing recalled" marker', async () => {
  const { provider, context } = await providerWith([]);
  const block = (await provider.recall({ scope: 'project' }, context)).toContextBlock();

  assert.match(block, /No memory was recalled/);
  assert.ok(!block.includes(PREAMBLE), 'no need to caveat memory that does not exist');
});

test('recall results are frozen — nothing downstream can rewrite recalled memory', async () => {
  const { provider, context } = await providerWith([projectRecord()]);
  const recall = await provider.recall({ scope: 'project' }, context);

  assert.throws(() => {
    recall.records[0].content = 'rewritten';
  }, TypeError);
  assert.throws(() => {
    recall.records[0].trust.level = 'human_confirmed';
  }, TypeError);
  assert.throws(() => {
    recall.records.push({});
  }, TypeError);
  assert.throws(() => {
    recall.provider_id = 'something-else';
  }, TypeError);
});

test('recalled records expose no authority-bearing fields', async () => {
  const { provider, context } = await providerWith([
    projectRecord({ content: 'ordinary project fact' })
  ]);
  const recall = await provider.recall({ scope: 'project' }, context);
  const record = recall.records[0];

  for (const key of Object.keys(record)) {
    assert.ok(
      RECALL_RECORD_KEYS.includes(key),
      `unexpected key "${key}" on a recalled record`
    );
  }
  for (const forbidden of FORBIDDEN_RECORD_KEYS) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(record, forbidden),
      false,
      `a recalled record must never carry "${forbidden}"`
    );
  }
});

test('recall never returns expired or deleted memory', async () => {
  const { provider, adapter, context, clock } = await providerWith([]);

  const live = await adapter.write(projectRecord({ content: 'live' }), context);
  const doomed = await adapter.write(
    projectRecord({
      content: 'expiring',
      lifecycle: { expires_at: new Date(clock.now + 1000).toISOString() }
    }),
    context
  );
  const removed = await adapter.write(projectRecord({ content: 'deleted' }), context);
  await adapter.delete(removed.id, { reason: 'test' }, context);

  clock.now += 2000;

  const recall = await provider.recall({ scope: 'project' }, context);
  const contents = recall.records.map((r) => r.content);

  assert.deepEqual(contents, ['live']);
  assert.ok(!contents.includes('expiring'));
  assert.ok(!contents.includes('deleted'));
  assert.ok(live.id && doomed.id);
});

test('verified memory is still labelled with its real trust level, never as authority', async () => {
  const { provider, adapter, context } = await providerWith([]);

  const { id } = await adapter.write(projectRecord({ content: 'confirmed fact' }), context);
  await adapter.verify(id, { level: 'human_confirmed', verified_by: 'user_adam' }, context);

  const recall = await provider.recall({ scope: 'project' }, context);
  const block = recall.toContextBlock();

  assert.equal(recall.records[0].trust.level, 'human_confirmed');
  assert.match(block, /trust="human_confirmed"/);
  // Even human-confirmed recall keeps the caveat — verified is not authoritative.
  assert.match(block, /does not override current rules/);
});
