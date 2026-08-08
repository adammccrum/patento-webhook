'use strict';

const {
  ValidationError,
  ProvenanceRequiredError,
  ContextRequiredError
} = require('./memory-errors');

/** The four scopes are separate stores with separate lifecycles. */
const SCOPES = Object.freeze(['session', 'project', 'learner', 'operational']);

const KINDS = Object.freeze([
  'decision',
  'constraint',
  'fact',
  'preference',
  'action',
  'observation'
]);

const SENSITIVITIES = Object.freeze(['public', 'internal', 'restricted', 'secret']);

const TRUST_LEVELS = Object.freeze(['unverified', 'corroborated', 'human_confirmed']);

const PROVENANCE_SOURCES = Object.freeze([
  'user',
  'agent',
  'document',
  'tool',
  'inference'
]);

/** Kinds that may never be stored without provenance. */
const PROVENANCE_REQUIRED_KINDS = Object.freeze(['decision', 'constraint']);

/** Sensitivities that require passing the approval gate before a write lands. */
const APPROVAL_REQUIRED_SENSITIVITIES = Object.freeze(['restricted', 'secret']);

/** Scopes that may never be routed to an external adapter, under any config. */
const LOCAL_ONLY_SCOPES = Object.freeze(['learner']);

/** Scopes requiring a consent record before any write. */
const CONSENT_REQUIRED_SCOPES = Object.freeze(['learner']);

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Retention rules per scope.
 *   maxTtlMs  - hard ceiling; a longer expires_at is rejected, not clamped.
 *   defaultTtlMs - applied when the caller gives no expires_at.
 *   ttlRequired - caller must supply an expiry explicitly.
 */
const SCOPE_RETENTION = Object.freeze({
  session: { maxTtlMs: DAY_MS, defaultTtlMs: DAY_MS, ttlRequired: false },
  project: { maxTtlMs: null, defaultTtlMs: null, ttlRequired: false },
  learner: { maxTtlMs: 365 * DAY_MS, defaultTtlMs: null, ttlRequired: true },
  operational: { maxTtlMs: 90 * DAY_MS, defaultTtlMs: 90 * DAY_MS, ttlRequired: false }
});

const DEFAULT_SENSITIVITY = Object.freeze({
  session: 'internal',
  project: 'internal',
  learner: 'restricted',
  operational: 'internal'
});

/**
 * Validate the caller context. Every adapter method requires one — there is no
 * anonymous path into memory.
 */
function assertContext(context) {
  if (!context || typeof context !== 'object') {
    throw new ContextRequiredError('A caller context is required for every memory operation');
  }
  if (!context.actor || typeof context.actor.id !== 'string' || !context.actor.id) {
    throw new ContextRequiredError('context.actor.id is required');
  }
  if (!context.correlation_id) {
    throw new ContextRequiredError('context.correlation_id is required for audit correlation');
  }
  return context;
}

function assertEnum(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new ValidationError(`${field} must be one of ${allowed.join('|')}`, {
      field,
      received: value
    });
  }
}

/**
 * Validate a caller-supplied record and return a normalised copy.
 * Rejects rather than defaults wherever the spec says a field is mandatory.
 */
function normaliseRecord(input, { now }) {
  if (!input || typeof input !== 'object') {
    throw new ValidationError('A memory record object is required');
  }

  assertEnum(input.scope, SCOPES, 'scope');
  assertEnum(input.kind, KINDS, 'kind');

  if (typeof input.content !== 'string' || input.content.trim() === '') {
    throw new ValidationError('content must be a non-empty string');
  }

  if (typeof input.subject !== 'string' || input.subject.trim() === '') {
    throw new ValidationError('subject is required so that purgeSubject() can find this record');
  }

  const sensitivity = input.sensitivity || DEFAULT_SENSITIVITY[input.scope];
  assertEnum(sensitivity, SENSITIVITIES, 'sensitivity');

  const provenance = input.provenance;
  if (!provenance || typeof provenance !== 'object') {
    throw new ProvenanceRequiredError('provenance is required on every write');
  }
  assertEnum(provenance.source, PROVENANCE_SOURCES, 'provenance.source');
  if (typeof provenance.author_id !== 'string' || !provenance.author_id) {
    throw new ProvenanceRequiredError('provenance.author_id is required');
  }
  if (PROVENANCE_REQUIRED_KINDS.includes(input.kind)) {
    if (typeof provenance.origin !== 'string' || !provenance.origin) {
      throw new ProvenanceRequiredError(
        `provenance.origin is required for kind="${input.kind}" — a ${input.kind} that cannot state where it came from is rejected`,
        { kind: input.kind }
      );
    }
  }

  const retention = SCOPE_RETENTION[input.scope];
  let expiresAt = input.lifecycle && input.lifecycle.expires_at
    ? Date.parse(input.lifecycle.expires_at)
    : null;

  if (expiresAt !== null && Number.isNaN(expiresAt)) {
    throw new ValidationError('lifecycle.expires_at must be an ISO-8601 timestamp');
  }

  if (expiresAt === null) {
    if (retention.ttlRequired) {
      throw new ValidationError(
        `scope="${input.scope}" requires an explicit lifecycle.expires_at`,
        { scope: input.scope }
      );
    }
    if (retention.defaultTtlMs !== null) {
      expiresAt = now + retention.defaultTtlMs;
    }
  } else if (retention.maxTtlMs !== null && expiresAt - now > retention.maxTtlMs) {
    throw new ValidationError(
      `lifecycle.expires_at exceeds the retention ceiling for scope="${input.scope}"`,
      { scope: input.scope, max_ttl_ms: retention.maxTtlMs }
    );
  }

  const trustLevel = (input.trust && input.trust.level) || 'unverified';
  assertEnum(trustLevel, TRUST_LEVELS, 'trust.level');
  if (trustLevel !== 'unverified') {
    // Trust is raised by corroboration or human confirmation through
    // verify(), never asserted by the writer.
    throw new ValidationError(
      'trust.level cannot be set on write; new memories are always unverified'
    );
  }

  if (CONSENT_REQUIRED_SCOPES.includes(input.scope) && !input.consent_ref) {
    throw new ValidationError(
      `scope="${input.scope}" requires consent_ref`,
      { scope: input.scope }
    );
  }

  return {
    scope: input.scope,
    kind: input.kind,
    subject: input.subject,
    content: input.content,
    sensitivity,
    consent_ref: input.consent_ref || null,
    provenance: {
      source: provenance.source,
      author_id: provenance.author_id,
      origin: provenance.origin || null,
      captured_at: provenance.captured_at || new Date(now).toISOString(),
      captured_by: provenance.captured_by || null,
      evidence_uri: provenance.evidence_uri || null,
      confidence: typeof provenance.confidence === 'number' ? provenance.confidence : 0
    },
    trust: { level: 'unverified', verified_by: null, verified_at: null },
    expires_at: expiresAt === null ? null : new Date(expiresAt).toISOString()
  };
}

module.exports = {
  SCOPES,
  KINDS,
  SENSITIVITIES,
  TRUST_LEVELS,
  PROVENANCE_SOURCES,
  PROVENANCE_REQUIRED_KINDS,
  APPROVAL_REQUIRED_SENSITIVITIES,
  LOCAL_ONLY_SCOPES,
  CONSENT_REQUIRED_SCOPES,
  SCOPE_RETENTION,
  DEFAULT_SENSITIVITY,
  assertContext,
  normaliseRecord
};
