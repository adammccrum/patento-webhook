'use strict';

const crypto = require('crypto');

const MemoryAdapter = require('./memory-adapter-base');
const { JournalStore } = require('./journal-store');
const { FileAuditSink } = require('./audit-sink');
const {
  assertContext,
  normaliseRecord,
  APPROVAL_REQUIRED_SENSITIVITIES,
  CONSENT_REQUIRED_SCOPES,
  SCOPES
} = require('./memory-schema');
const {
  ValidationError,
  ConsentRequiredError,
  ApprovalRequiredError,
  ScopePermissionError,
  NotFoundError,
  MemoryUnavailableError
} = require('./memory-errors');

/**
 * Consent registry. Denies by default — learner memory cannot be written
 * because nobody remembered to configure consent.
 */
class DenyAllConsentRegistry {
  async isActive() {
    return false;
  }
}

function newId() {
  return `mem_${Date.now().toString(16)}${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Local, on-disk memory adapter. No network egress of any kind.
 *
 * This is the default provider and the reference implementation of
 * docs/MEMORY_PROVIDER_SPECIFICATION.md.
 */
class LocalMemoryAdapter extends MemoryAdapter {
  constructor(config = {}) {
    super({
      id: config.id || 'local-memory',
      name: config.name || 'Local Memory',
      capabilities: [
        'persistent-recall',
        'provenance',
        'correction',
        'expiry',
        'subject-erasure',
        'export'
      ],
      ...config
    });

    this.external = false;
    this.allow_egress = false;

    this.path = config.path || './.memory/memory.jsonl';
    this.store = config.store || new JournalStore({ path: this.path });
    this.audit =
      config.auditSink || new FileAuditSink({ path: config.auditPath || './.memory/audit.jsonl' });
    this.consent = config.consentRegistry || new DenyAllConsentRegistry();
    this.now = config.now || (() => Date.now());

    this.records = new Map();
    this.proposals = new Map();
    this.ready = false;
  }

  // ---- lifecycle ----

  async init() {
    await this.store.load();
    this.records = this.store.materialise();
    this.ready = true;
    this.health = 'healthy';
    return this;
  }

  async healthCheck() {
    this.health = this.ready ? 'healthy' : 'unknown';
    this.last_checked = new Date(this.now()).toISOString();
    return this.health;
  }

  assertReady() {
    if (!this.ready) {
      throw new MemoryUnavailableError('LocalMemoryAdapter.init() has not completed');
    }
  }

  // ---- permissions ----

  requirePermission(context, op, scope) {
    const needed = `memory:${op}:${scope}`;
    const held = context.permissions || [];
    if (held.includes('memory:*') || held.includes(needed)) return;
    throw new ScopePermissionError(`Caller lacks permission ${needed}`, {
      required: needed,
      actor: context.actor.id
    });
  }

  // ---- helpers ----

  isLive(record, at) {
    if (record.deleted_at) return false;
    if (record.superseded_by) return false;
    if (record.expires_at && Date.parse(record.expires_at) <= at) return false;
    return true;
  }

  getLive(id, at) {
    const record = this.records.get(id);
    if (!record || !this.isLive(record, at)) {
      throw new NotFoundError(`No live memory with id ${id}`, { id });
    }
    return record;
  }

  /**
   * Audit first, persist second, acknowledge third. If the audit sink refuses,
   * nothing is written.
   */
  async auditThenPersist(auditEvent, buildJournalEvent) {
    const auditEventId = await this.audit.record(auditEvent);
    const journalEvent = buildJournalEvent(auditEventId);
    await this.store.append(journalEvent);
    this.records = this.store.materialise();
    return auditEventId;
  }

  // ---- write ----

  async write(input, context) {
    this.assertReady();
    assertContext(context);

    const at = this.now();
    const normalised = normaliseRecord(input, { now: at });

    this.requirePermission(context, 'write', normalised.scope);

    if (CONSENT_REQUIRED_SCOPES.includes(normalised.scope)) {
      const active = await this.consent.isActive(normalised.consent_ref, normalised.subject);
      if (!active) {
        throw new ConsentRequiredError(
          `No active consent ${normalised.consent_ref} for subject ${normalised.subject}`,
          { scope: normalised.scope, consent_ref: normalised.consent_ref }
        );
      }
    }

    if (APPROVAL_REQUIRED_SENSITIVITIES.includes(normalised.sensitivity)) {
      this.consumeApproval(context, normalised);
    }

    if (!input.reason || typeof input.reason !== 'string' || input.reason.trim() === '') {
      throw new ValidationError(
        'A written reason is required. Memory writes are explicit acts, not side effects.'
      );
    }

    const id = newId();
    const record = {
      id,
      ...normalised,
      created_at: new Date(at).toISOString(),
      superseded_by: null,
      supersedes: null,
      deleted_at: null,
      revision: 1
    };

    const auditEventId = await this.auditThenPersist(
      {
        action: 'memory.write',
        scope: record.scope,
        kind: record.kind,
        subject: record.subject,
        memory_id: id,
        provider: this.id,
        actor: context.actor.id,
        correlation_id: context.correlation_id,
        reason: input.reason,
        sensitivity: record.sensitivity
      },
      (auditId) => ({ op: 'write', at: new Date(at).toISOString(), record: { ...record, audit_event_id: auditId } })
    );

    return { id, audit_event_id: auditEventId };
  }

  /** Stage a memory for approval without committing it. */
  async propose(input, context) {
    this.assertReady();
    assertContext(context);

    const at = this.now();
    const normalised = normaliseRecord(input, { now: at });
    this.requirePermission(context, 'write', normalised.scope);

    const proposalId = `prop_${crypto.randomBytes(8).toString('hex')}`;
    this.proposals.set(proposalId, {
      proposal_id: proposalId,
      scope: normalised.scope,
      subject: normalised.subject,
      sensitivity: normalised.sensitivity,
      content_hash: crypto.createHash('sha256').update(normalised.content).digest('hex'),
      proposed_by: context.actor.id,
      proposed_at: new Date(at).toISOString(),
      consumed: false
    });

    await this.audit.record({
      action: 'memory.propose',
      scope: normalised.scope,
      subject: normalised.subject,
      proposal_id: proposalId,
      provider: this.id,
      actor: context.actor.id,
      correlation_id: context.correlation_id,
      sensitivity: normalised.sensitivity
    });

    return { proposal_id: proposalId, requires_approval: true };
  }

  consumeApproval(context, normalised) {
    const approval = context.approval;
    if (!approval || !approval.proposal_id || !approval.approved_by) {
      throw new ApprovalRequiredError(
        `sensitivity="${normalised.sensitivity}" requires an approved proposal`,
        { sensitivity: normalised.sensitivity }
      );
    }

    const proposal = this.proposals.get(approval.proposal_id);
    if (!proposal) {
      throw new ApprovalRequiredError('Unknown proposal', { proposal_id: approval.proposal_id });
    }
    if (proposal.consumed) {
      throw new ApprovalRequiredError('Proposal already used', {
        proposal_id: approval.proposal_id
      });
    }
    if (proposal.approved_by === undefined && !approval.approved_by) {
      throw new ApprovalRequiredError('Proposal not approved');
    }

    const hash = crypto.createHash('sha256').update(normalised.content).digest('hex');
    if (hash !== proposal.content_hash) {
      throw new ApprovalRequiredError(
        'Approved content does not match the content being written',
        { proposal_id: approval.proposal_id }
      );
    }
    if (proposal.proposed_by === approval.approved_by) {
      throw new ApprovalRequiredError('A proposal cannot be approved by its proposer', {
        proposal_id: approval.proposal_id
      });
    }

    proposal.consumed = true;
    this.proposals.set(proposal.proposal_id, proposal);
  }

  // ---- read ----

  async read(query = {}, context) {
    this.assertReady();
    assertContext(context);

    const scopes = query.scopes || (query.scope ? [query.scope] : null);
    if (!scopes || scopes.length === 0) {
      throw new ValidationError(
        'read() requires an explicit scope or scopes — cross-scope reads are never implicit'
      );
    }
    for (const scope of scopes) {
      if (!SCOPES.includes(scope)) {
        throw new ValidationError(`Unknown scope ${scope}`, { scope });
      }
      this.requirePermission(context, 'read', scope);
    }

    const at = this.now();
    let results = [...this.records.values()]
      .filter((r) => scopes.includes(r.scope))
      .filter((r) => this.isLive(r, at));

    if (query.subject) results = results.filter((r) => r.subject === query.subject);
    if (query.kind) results = results.filter((r) => r.kind === query.kind);
    if (query.id) results = results.filter((r) => r.id === query.id);

    results.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    if (query.limit) results = results.slice(0, query.limit);

    for (const record of results) {
      if (APPROVAL_REQUIRED_SENSITIVITIES.includes(record.sensitivity)) {
        await this.audit.record({
          action: 'memory.read.restricted',
          scope: record.scope,
          memory_id: record.id,
          provider: this.id,
          actor: context.actor.id,
          correlation_id: context.correlation_id,
          sensitivity: record.sensitivity
        });
      }
    }

    return results.map((r) => ({ ...r }));
  }

  /** Keyword relevance search within permitted scopes. No embeddings, no egress. */
  async search(query = {}, context) {
    const text = (query.text || '').toLowerCase().trim();
    const candidates = await this.read({ ...query, limit: null }, context);
    if (text === '') return candidates.slice(0, query.limit || 20);

    const terms = text.split(/\s+/).filter(Boolean);
    const scored = candidates
      .map((record) => {
        const haystack = `${record.content} ${record.subject}`.toLowerCase();
        const score = terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
        return { record, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, query.limit || 20).map((entry) => entry.record);
  }

  // ---- correction, deletion, expiry ----

  /** Supersede rather than overwrite. The original survives, marked superseded. */
  async correct(id, newInput, context) {
    this.assertReady();
    assertContext(context);

    const at = this.now();
    const previous = this.getLive(id, at);
    this.requirePermission(context, 'write', previous.scope);

    if (!newInput.reason) {
      throw new ValidationError('A written reason is required to correct a memory');
    }

    const normalised = normaliseRecord(
      {
        scope: previous.scope,
        kind: previous.kind,
        subject: previous.subject,
        sensitivity: previous.sensitivity,
        consent_ref: previous.consent_ref,
        ...newInput
      },
      { now: at }
    );

    if (APPROVAL_REQUIRED_SENSITIVITIES.includes(normalised.sensitivity)) {
      this.consumeApproval(context, normalised);
    }

    const newRecordId = newId();
    const record = {
      id: newRecordId,
      ...normalised,
      created_at: new Date(at).toISOString(),
      superseded_by: null,
      supersedes: previous.id,
      deleted_at: null,
      revision: previous.revision + 1
    };

    const auditEventId = await this.auditThenPersist(
      {
        action: 'memory.correct',
        scope: record.scope,
        memory_id: newRecordId,
        supersedes: previous.id,
        provider: this.id,
        actor: context.actor.id,
        correlation_id: context.correlation_id,
        reason: newInput.reason,
        sensitivity: record.sensitivity
      },
      (auditId) => ({
        op: 'correct',
        at: new Date(at).toISOString(),
        supersedes: previous.id,
        record: { ...record, audit_event_id: auditId }
      })
    );

    return { id: newRecordId, supersedes: previous.id, revision: record.revision, audit_event_id: auditEventId };
  }

  async delete(id, options = {}, context) {
    this.assertReady();
    assertContext(context);

    const at = this.now();
    const record = this.records.get(id);
    if (!record) throw new NotFoundError(`No memory with id ${id}`, { id });
    this.requirePermission(context, 'delete', record.scope);

    const hard = options.hard === true;

    const auditEventId = await this.audit.record({
      action: hard ? 'memory.delete.hard' : 'memory.delete',
      scope: record.scope,
      memory_id: id,
      provider: this.id,
      actor: context.actor.id,
      correlation_id: context.correlation_id,
      reason: options.reason || null,
      sensitivity: record.sensitivity
    });

    if (hard) {
      await this.store.hardRemove(
        (event) =>
          (event.op === 'write' || event.op === 'correct') && event.record && event.record.id === id,
        {
          op: 'erased',
          at: new Date(at).toISOString(),
          memory_id: id,
          audit_event_id: auditEventId
        }
      );
    } else {
      await this.store.append({
        op: 'delete',
        at: new Date(at).toISOString(),
        id,
        hard: false,
        audit_event_id: auditEventId
      });
    }

    this.records = this.store.materialise();
    return { id, hard, audit_event_id: auditEventId };
  }

  async expire(id, expiresAt, context) {
    this.assertReady();
    assertContext(context);

    const at = this.now();
    const record = this.getLive(id, at);
    this.requirePermission(context, 'write', record.scope);

    const parsed = Date.parse(expiresAt);
    if (Number.isNaN(parsed)) {
      throw new ValidationError('expiresAt must be an ISO-8601 timestamp');
    }

    const auditEventId = await this.auditThenPersist(
      {
        action: 'memory.expire',
        scope: record.scope,
        memory_id: id,
        provider: this.id,
        actor: context.actor.id,
        correlation_id: context.correlation_id,
        expires_at: new Date(parsed).toISOString()
      },
      (auditId) => ({
        op: 'expire',
        at: new Date(at).toISOString(),
        id,
        expires_at: new Date(parsed).toISOString(),
        audit_event_id: auditId
      })
    );

    return { id, expires_at: new Date(parsed).toISOString(), audit_event_id: auditEventId };
  }

  /**
   * Erase everything for a subject. Physically removes content from the
   * journal — a derived or superseded record must not outlive its source.
   */
  async purgeSubject(subjectId, context) {
    this.assertReady();
    assertContext(context);

    const at = this.now();
    const affected = [...this.records.values()].filter((r) => r.subject === subjectId);
    const scopes = [...new Set(affected.map((r) => r.scope))];
    for (const scope of scopes) {
      this.requirePermission(context, 'delete', scope);
    }

    const auditEventId = await this.audit.record({
      action: 'memory.purge_subject',
      subject: subjectId,
      scopes,
      record_count: affected.length,
      provider: this.id,
      actor: context.actor.id,
      correlation_id: context.correlation_id
    });

    const removed = await this.store.hardRemove(
      (event) =>
        (event.op === 'write' || event.op === 'correct') &&
        event.record &&
        event.record.subject === subjectId,
      {
        op: 'erased',
        at: new Date(at).toISOString(),
        subject: subjectId,
        record_count: affected.length,
        audit_event_id: auditEventId
      }
    );

    this.records = this.store.materialise();
    return { subject: subjectId, erased: removed, audit_event_id: auditEventId };
  }

  /** Remove records whose expiry has passed. */
  async sweepExpired(context) {
    this.assertReady();
    assertContext(context);

    const at = this.now();
    const expired = [...this.records.values()].filter(
      (r) => r.expires_at && Date.parse(r.expires_at) <= at
    );
    if (expired.length === 0) return { erased: 0 };

    const ids = new Set(expired.map((r) => r.id));
    const auditEventId = await this.audit.record({
      action: 'memory.sweep_expired',
      record_count: expired.length,
      provider: this.id,
      actor: context.actor.id,
      correlation_id: context.correlation_id
    });

    const removed = await this.store.hardRemove(
      (event) =>
        (event.op === 'write' || event.op === 'correct') && event.record && ids.has(event.record.id),
      {
        op: 'erased',
        at: new Date(at).toISOString(),
        reason: 'expired',
        record_count: expired.length,
        audit_event_id: auditEventId
      }
    );

    this.records = this.store.materialise();
    return { erased: removed, audit_event_id: auditEventId };
  }

  /** Raise trust. Never called by a writer asserting its own reliability. */
  async verify(id, { level, verified_by }, context) {
    this.assertReady();
    assertContext(context);

    const at = this.now();
    const record = this.getLive(id, at);
    this.requirePermission(context, 'verify', record.scope);

    if (!['corroborated', 'human_confirmed'].includes(level)) {
      throw new ValidationError('trust level must be corroborated or human_confirmed');
    }
    if (!verified_by) throw new ValidationError('verified_by is required');
    if (verified_by === record.provenance.author_id) {
      throw new ValidationError('A memory cannot be verified by its own author');
    }

    const auditEventId = await this.auditThenPersist(
      {
        action: 'memory.verify',
        scope: record.scope,
        memory_id: id,
        provider: this.id,
        actor: context.actor.id,
        correlation_id: context.correlation_id,
        trust_level: level
      },
      (auditId) => ({
        op: 'verify',
        at: new Date(at).toISOString(),
        id,
        level,
        verified_by,
        audit_event_id: auditId
      })
    );

    return { id, trust_level: level, audit_event_id: auditEventId };
  }

  // ---- transparency ----

  async getProvenance(id, context) {
    this.assertReady();
    assertContext(context);

    const record = this.records.get(id);
    if (!record) throw new NotFoundError(`No memory with id ${id}`, { id });
    this.requirePermission(context, 'read', record.scope);

    const chain = [];
    let cursor = record;
    while (cursor) {
      chain.push({
        id: cursor.id,
        revision: cursor.revision,
        content: cursor.content,
        provenance: { ...cursor.provenance },
        trust: { ...cursor.trust },
        created_at: cursor.created_at,
        superseded_by: cursor.superseded_by,
        audit_event_id: cursor.audit_event_id
      });
      cursor = cursor.supersedes ? this.records.get(cursor.supersedes) : null;
    }

    return { id, chain };
  }

  async export(subjectId, context) {
    this.assertReady();
    assertContext(context);

    const records = [...this.records.values()].filter((r) => r.subject === subjectId);
    const scopes = [...new Set(records.map((r) => r.scope))];
    for (const scope of scopes) {
      this.requirePermission(context, 'read', scope);
    }

    await this.audit.record({
      action: 'memory.export',
      subject: subjectId,
      scopes,
      record_count: records.length,
      provider: this.id,
      actor: context.actor.id,
      correlation_id: context.correlation_id
    });

    return {
      format: 'memory-export/v1',
      subject: subjectId,
      exported_at: new Date(this.now()).toISOString(),
      provider: this.id,
      records: records.map((r) => ({ ...r }))
    };
  }
}

module.exports = { LocalMemoryAdapter, DenyAllConsentRegistry };
