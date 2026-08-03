/**
 * Custom error types for domain logic.
 * Errors are data-driven (no stack traces in production).
 */

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export class NotFoundError extends DomainError {
  constructor(entityType: string, id: string) {
    super('NOT_FOUND', `${entityType} not found: ${id}`, { entityType, id });
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class StateTransitionError extends DomainError {
  constructor(entityType: string, currentState: string, attemptedState: string) {
    super('INVALID_STATE_TRANSITION', `Cannot transition ${entityType} from ${currentState} to ${attemptedState}`, {
      entityType,
      currentState,
      attemptedState,
    });
    this.name = 'StateTransitionError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFLICT', message, details);
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('UNAUTHORIZED', message, details);
    this.name = 'UnauthorizedError';
  }
}
