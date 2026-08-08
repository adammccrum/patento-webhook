'use strict';

/**
 * Typed errors for the memory subsystem.
 *
 * Every one of these represents a deliberate refusal. None of them should ever
 * be caught and converted into a silent fallback — see MemoryProvider's
 * fail-closed rule in docs/MEMORY_PROVIDER_SPECIFICATION.md.
 */

class MemoryError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

/** Caller identity / permission context missing or malformed. */
class ContextRequiredError extends MemoryError {}

/** Record failed schema or scope validation. */
class ValidationError extends MemoryError {}

/** Provenance missing where the spec mandates it. */
class ProvenanceRequiredError extends MemoryError {}

/** learner-scope write attempted without a resolvable consent record. */
class ConsentRequiredError extends MemoryError {}

/** restricted/secret write attempted without passing the approval gate. */
class ApprovalRequiredError extends MemoryError {}

/** Audit sink refused or failed; the memory write must not be acknowledged. */
class AuditWriteError extends MemoryError {}

/** Caller lacks permission for the requested scope. */
class ScopePermissionError extends MemoryError {}

/** Egress gate refused to route this record to an external adapter. */
class EgressDeniedError extends MemoryError {}

/**
 * Memory provider unavailable. Raised instead of falling back to a secondary
 * store — a split memory record would defeat the audit trail.
 */
class MemoryUnavailableError extends MemoryError {}

/** Recall was asked to render itself into the system prompt. */
class SystemPromptInjectionError extends MemoryError {}

class NotFoundError extends MemoryError {}

module.exports = {
  MemoryError,
  ContextRequiredError,
  ValidationError,
  ProvenanceRequiredError,
  ConsentRequiredError,
  ApprovalRequiredError,
  AuditWriteError,
  ScopePermissionError,
  EgressDeniedError,
  MemoryUnavailableError,
  SystemPromptInjectionError,
  NotFoundError
};
