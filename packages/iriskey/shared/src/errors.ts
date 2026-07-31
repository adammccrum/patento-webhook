/**
 * Error handling utilities
 */

/**
 * Application error with status code and message
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string, public fields?: Record<string, string[]>) {
    super(400, message, 'validation_error');
    this.name = 'ValidationError';
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(message: string) {
    super(401, message, 'authentication_error');
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
  constructor(message: string) {
    super(403, message, 'authorization_error');
    this.name = 'AuthorizationError';
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message, 'not_found');
    this.name = 'NotFoundError';
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  constructor(message: string, public retryAfter?: number) {
    super(429, message, 'rate_limit_exceeded');
    this.name = 'RateLimitError';
  }
}

/**
 * Server error
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(500, message, 'internal_server_error');
    this.name = 'InternalServerError';
  }
}
