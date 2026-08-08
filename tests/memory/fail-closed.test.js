'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeAdapter, ctx, projectRecord, cleanup, StubExternalAdapter } = require('./helpers/harness');
const { MemoryProvider } = require('../../src/providers/memory-provider');
const { MemoryUnavailableError } = require('../../src/providers/adapters/memory/memory-errors');

test.after(cleanup);

test('fallback is not a configurable option', async () => {
  const { adapter } = await makeAdapter();
  const provider = new MemoryProvider({ adapters: [adapter] });

  assert.equal(provider.fallbackEnabled, false);
  assert.equal(typeof provider.tryAdapters, 'undefined', 'memory must not inherit a fallback chain');
});

test('an unhealthy provider raises rather than substituting another store', async () => {
  const { adapter } = await makeAdapter();
  const spare = await makeAdapter();
  spare.adapter.id = 'spare-local';

  const provider = new MemoryProvider({ adapters: [adapter, spare.adapter] });
  const context = ctx();

  adapter.health = 'unhealthy';

  await assert.rejects(
    () => provider.write(projectRecord(), context),
    MemoryUnavailableError,
    'the write must fail, not land in a different store'
  );

  assert.equal(
    (await spare.adapter.read({ scope: 'project' }, context)).length,
    0,
    'no memory may leak into the spare adapter'
  );
});

test('the unavailability error records that no fallback was attempted', async () => {
  const { adapter } = await makeAdapter();
  const provider = new MemoryProvider({ adapters: [adapter] });
  adapter.health = 'unhealthy';

  await assert.rejects(
    () => provider.write(projectRecord(), ctx()),
    (err) => {
      assert.ok(err instanceof MemoryUnavailableError);
      assert.equal(err.details.fallback_attempted, false);
      return true;
    }
  );
});

test('a disabled provider fails closed', async () => {
  const { adapter } = await makeAdapter();
  const provider = new MemoryProvider({ adapters: [adapter] });
  adapter.enabled = false;

  await assert.rejects(() => provider.write(projectRecord(), ctx()), MemoryUnavailableError);
  await assert.rejects(() => provider.recall({ scope: 'project' }, ctx()), MemoryUnavailableError);
});

test('reads fail closed too — no silent empty result', async () => {
  const { adapter } = await makeAdapter();
  const provider = new MemoryProvider({ adapters: [adapter] });
  const context = ctx();

  await provider.write(projectRecord(), context);
  adapter.health = 'unhealthy';

  await assert.rejects(() => provider.read({ scope: 'project' }, context), MemoryUnavailableError);
  await assert.rejects(() => provider.search({ scope: 'project', text: 'x' }, context), MemoryUnavailableError);
});

test('an external adapter failure does not fall back to local', async () => {
  const { adapter } = await makeAdapter();
  const external = new StubExternalAdapter({
    allow_egress: true,
    allowed_scopes: ['project'],
    declared_destinations: ['http://127.0.0.1:8420']
  });
  external.shouldThrow = true;

  const provider = new MemoryProvider({ adapters: [adapter, external] });
  const context = ctx();

  await assert.rejects(() => provider.write(projectRecord(), context), /external engine exploded/);

  assert.equal(
    (await adapter.read({ scope: 'project' }, context)).length,
    0,
    'a failed external write must not be silently rerouted to the local store'
  );
});

test('an uninitialised adapter refuses to operate', async () => {
  const { LocalMemoryAdapter } = require('../../src/providers/adapters/memory/local-memory-adapter');
  const { InMemoryAuditSink } = require('../../src/providers/adapters/memory/audit-sink');
  const { tempDir } = require('./helpers/harness');
  const path = require('path');

  const adapter = new LocalMemoryAdapter({
    path: path.join(tempDir(), 'memory.jsonl'),
    auditSink: new InMemoryAuditSink()
  });

  await assert.rejects(() => adapter.write(projectRecord(), ctx()), MemoryUnavailableError);
  await assert.rejects(() => adapter.read({ scope: 'project' }, ctx()), MemoryUnavailableError);
});
