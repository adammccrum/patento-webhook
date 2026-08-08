'use strict';

const { RecallResult } = require('./adapters/memory/recall');
const { LOCAL_ONLY_SCOPES, APPROVAL_REQUIRED_SENSITIVITIES, assertContext } = require('./adapters/memory/memory-schema');
const {
  EgressDeniedError,
  MemoryUnavailableError,
  ValidationError
} = require('./adapters/memory/memory-errors');

/**
 * The application-facing memory facade.
 *
 * Everything above this line talks to `MemoryProvider`. Nothing above this line
 * knows which engine is underneath. Two rules live here rather than in any
 * adapter, because they must hold no matter which engine is configured:
 *
 *   1. The egress gate — learner and restricted/secret memory never reach an
 *      external adapter, whatever the config says.
 *   2. Fail closed — if the selected provider is unavailable, agents run
 *      without memory. There is no automatic fallback to a secondary store,
 *      because a split memory record would defeat the audit trail.
 */
class MemoryProvider {
  constructor({ adapters = [], defaultAdapterId = 'local-memory' } = {}) {
    this.adapters = new Map();
    this.defaultAdapterId = defaultAdapterId;

    /** Deliberately not configurable. See rule 2 above. */
    this.fallbackEnabled = false;

    for (const adapter of adapters) {
      this.register(adapter);
    }

    if (!this.adapters.has(defaultAdapterId)) {
      throw new ValidationError(`Default memory adapter "${defaultAdapterId}" is not registered`);
    }
    if (this.adapters.get(defaultAdapterId).external) {
      throw new EgressDeniedError('The default memory adapter must be local');
    }
  }

  /**
   * Register an adapter. External adapters are validated at startup, not at
   * write time — a config that could ever route learner memory off the machine
   * is rejected before it can run.
   */
  register(adapter) {
    if (adapter.external) {
      const allowed = adapter.allowed_scopes || [];
      const forbidden = allowed.filter((scope) => LOCAL_ONLY_SCOPES.includes(scope));
      if (forbidden.length > 0) {
        throw new EgressDeniedError(
          `External adapter "${adapter.id}" declares local-only scopes: ${forbidden.join(', ')}`,
          { adapter: adapter.id, scopes: forbidden }
        );
      }
      if (adapter.allow_egress && !adapter.declared_destinations) {
        throw new EgressDeniedError(
          `External adapter "${adapter.id}" must declare its destinations before egress is permitted`,
          { adapter: adapter.id }
        );
      }
    }
    this.adapters.set(adapter.id, adapter);
    return this;
  }

  get local() {
    return this.adapters.get(this.defaultAdapterId);
  }

  /**
   * The egress gate. Returns the adapter this record may be routed to.
   * Defaults to local for everything.
   */
  route({ scope, sensitivity }) {
    if (LOCAL_ONLY_SCOPES.includes(scope)) return this.local;
    if (APPROVAL_REQUIRED_SENSITIVITIES.includes(sensitivity)) return this.local;

    const candidates = [...this.adapters.values()].filter(
      (a) => a.external && a.enabled && a.allow_egress && (a.allowed_scopes || []).includes(scope)
    );

    return candidates.length > 0 ? candidates[0] : this.local;
  }

  /** Fail closed. Never substitutes a different store. */
  assertAvailable(adapter) {
    if (!adapter) {
      throw new MemoryUnavailableError('No memory adapter selected');
    }
    if (!adapter.enabled) {
      throw new MemoryUnavailableError(`Memory adapter "${adapter.id}" is disabled`, {
        adapter: adapter.id,
        fallback_attempted: false
      });
    }
    if (adapter.health === 'unhealthy') {
      throw new MemoryUnavailableError(
        `Memory adapter "${adapter.id}" is unhealthy; running without memory rather than falling back`,
        { adapter: adapter.id, fallback_attempted: false }
      );
    }
    return adapter;
  }

  // ---- writes ----

  async write(record, context) {
    assertContext(context);
    const adapter = this.assertAvailable(this.route(record));

    if (adapter.external && LOCAL_ONLY_SCOPES.includes(record.scope)) {
      // Belt and braces: route() cannot produce this, and if it ever did, stop.
      throw new EgressDeniedError(`scope="${record.scope}" may never leave the local adapter`, {
        scope: record.scope
      });
    }

    return adapter.write(record, context);
  }

  async propose(record, context) {
    const adapter = this.assertAvailable(this.route(record));
    return adapter.propose(record, context);
  }

  async correct(id, newRecord, context) {
    const adapter = this.assertAvailable(this.adapterFor(id));
    return adapter.correct(id, newRecord, context);
  }

  async delete(id, options, context) {
    const adapter = this.assertAvailable(this.adapterFor(id));
    return adapter.delete(id, options, context);
  }

  async expire(id, expiresAt, context) {
    const adapter = this.assertAvailable(this.adapterFor(id));
    return adapter.expire(id, expiresAt, context);
  }

  /** Erasure fans out to every adapter — consent revocation must reach all of them. */
  async purgeSubject(subjectId, context) {
    const results = [];
    for (const adapter of this.adapters.values()) {
      if (!adapter.enabled) continue;
      results.push(await adapter.purgeSubject(subjectId, context));
    }
    return results;
  }

  adapterFor(_id) {
    // Records live in the adapter that wrote them. With only the local adapter
    // registered this is unambiguous; a future external adapter carries its own
    // id prefix and this resolves on that.
    return this.local;
  }

  // ---- reads ----

  async read(query, context) {
    const adapter = this.assertAvailable(this.local);
    return adapter.read(query, context);
  }

  async search(query, context) {
    const adapter = this.assertAvailable(this.local);
    return adapter.search(query, context);
  }

  /**
   * Retrieve memory as untrusted recall.
   *
   * This is the method agents should use. It returns a frozen RecallResult that
   * refuses to render into the system prompt.
   */
  async recall(query, context) {
    const adapter = this.assertAvailable(this.local);
    const records = query && query.text
      ? await adapter.search(query, context)
      : await adapter.read(query, context);

    return new RecallResult({
      records,
      scopes: query.scopes || (query.scope ? [query.scope] : []),
      query: query.text || null,
      providerId: adapter.id,
      retrievedAt: new Date().toISOString()
    });
  }

  async getProvenance(id, context) {
    const adapter = this.assertAvailable(this.adapterFor(id));
    return adapter.getProvenance(id, context);
  }

  async export(subjectId, context) {
    const adapter = this.assertAvailable(this.local);
    return adapter.export(subjectId, context);
  }
}

module.exports = { MemoryProvider };
