'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeAdapter, ctx, projectRecord, cleanup, StubConsentRegistry } = require('./helpers/harness');
const { ConsentRequiredError, ValidationError, ScopePermissionError } = require('../../src/providers/adapters/memory/memory-errors');

test.after(cleanup);

test('scope isolation: a read in one scope never returns another scope', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  await adapter.write(projectRecord({ content: 'project-scope-content' }), context);
  await adapter.write(
    projectRecord({ scope: 'session', content: 'session-scope-content' }),
    context
  );
  await adapter.write(
    projectRecord({ scope: 'operational', content: 'operational-scope-content' }),
    context
  );

  const project = await adapter.read({ scope: 'project' }, context);
  assert.equal(project.length, 1);
  assert.equal(project[0].content, 'project-scope-content');

  const session = await adapter.read({ scope: 'session' }, context);
  assert.equal(session.length, 1);
  assert.equal(session[0].content, 'session-scope-content');

  const operational = await adapter.read({ scope: 'operational' }, context);
  assert.equal(operational.length, 1);
  assert.equal(operational[0].content, 'operational-scope-content');
});

test('scope isolation: cross-scope reads must be requested explicitly', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  await adapter.write(projectRecord(), context);
  await adapter.write(projectRecord({ scope: 'session' }), context);

  await assert.rejects(() => adapter.read({}, context), ValidationError);

  const both = await adapter.read({ scopes: ['project', 'session'] }, context);
  assert.equal(both.length, 2);
});

test('scope isolation: permissions are checked per scope', async () => {
  const { adapter } = await makeAdapter();
  const projectOnly = ctx({ permissions: ['memory:write:project', 'memory:read:project'] });

  await adapter.write(projectRecord(), projectOnly);

  await assert.rejects(
    () => adapter.write(projectRecord({ scope: 'operational' }), projectOnly),
    ScopePermissionError
  );
  await assert.rejects(
    () => adapter.read({ scope: 'operational' }, projectOnly),
    ScopePermissionError
  );
});

test('session memory is not promoted to project memory automatically', async () => {
  const { adapter } = await makeAdapter();
  const context = ctx();

  await adapter.write(projectRecord({ scope: 'session', content: 'ephemeral note' }), context);

  const project = await adapter.read({ scope: 'project' }, context);
  assert.equal(project.length, 0, 'session content must not appear in project scope');
});

test('session memory carries a 24h retention ceiling', async () => {
  const { adapter, clock } = await makeAdapter();
  const context = ctx();

  const { id } = await adapter.write(projectRecord({ scope: 'session' }), context);
  const [record] = await adapter.read({ scope: 'session', id }, context);
  assert.ok(record.expires_at, 'session memory must have a default expiry');
  assert.ok(Date.parse(record.expires_at) - clock.now <= 24 * 60 * 60 * 1000);

  const tooLong = new Date(clock.now + 48 * 60 * 60 * 1000).toISOString();
  await assert.rejects(
    () =>
      adapter.write(
        projectRecord({ scope: 'session', lifecycle: { expires_at: tooLong } }),
        context
      ),
    ValidationError
  );
});

test('learner memory requires an explicit consent_ref', async () => {
  const { adapter, clock } = await makeAdapter();
  const context = ctx();
  const expires = new Date(clock.now + 30 * 24 * 60 * 60 * 1000).toISOString();

  await assert.rejects(
    () =>
      adapter.write(
        projectRecord({
          scope: 'learner',
          subject: 'learner_42',
          sensitivity: 'internal',
          lifecycle: { expires_at: expires }
        }),
        context
      ),
    ValidationError,
    'learner write without consent_ref must be rejected'
  );
});

test('learner memory requires an ACTIVE consent record, not merely a reference', async () => {
  const { adapter, clock } = await makeAdapter({
    consentRegistry: new StubConsentRegistry([])
  });
  const context = ctx();
  const expires = new Date(clock.now + 30 * 24 * 60 * 60 * 1000).toISOString();

  await assert.rejects(
    () =>
      adapter.write(
        projectRecord({
          scope: 'learner',
          subject: 'learner_42',
          sensitivity: 'internal',
          consent_ref: 'consent_unknown',
          lifecycle: { expires_at: expires }
        }),
        context
      ),
    ConsentRequiredError
  );
});

test('learner memory requires an explicit expiry', async () => {
  const { adapter } = await makeAdapter({
    consentRegistry: new StubConsentRegistry(['consent_1'])
  });
  const context = ctx();

  await assert.rejects(
    () =>
      adapter.write(
        projectRecord({
          scope: 'learner',
          subject: 'learner_42',
          sensitivity: 'internal',
          consent_ref: 'consent_1'
        }),
        context
      ),
    ValidationError,
    'learner scope must not accept an open-ended retention period'
  );
});

test('learner memory defaults to restricted sensitivity', async () => {
  const { adapter, clock } = await makeAdapter({
    consentRegistry: new StubConsentRegistry(['consent_1'])
  });
  const context = ctx();
  const expires = new Date(clock.now + 30 * 24 * 60 * 60 * 1000).toISOString();

  const proposal = await adapter.propose(
    projectRecord({
      scope: 'learner',
      subject: 'learner_42',
      consent_ref: 'consent_1',
      content: 'Prefers worked examples before theory.',
      lifecycle: { expires_at: expires }
    }),
    context
  );

  assert.equal(proposal.requires_approval, true);

  const approved = ctx({
    approval: { proposal_id: proposal.proposal_id, approved_by: 'user_adam' }
  });
  const { id } = await adapter.write(
    projectRecord({
      scope: 'learner',
      subject: 'learner_42',
      consent_ref: 'consent_1',
      content: 'Prefers worked examples before theory.',
      lifecycle: { expires_at: expires }
    }),
    approved
  );

  const [record] = await adapter.read({ scope: 'learner', id }, approved);
  assert.equal(record.sensitivity, 'restricted');
});
