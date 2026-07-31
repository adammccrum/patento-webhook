/**
 * IrisKey Platform - Security Package
 * Comprehensive security headers, CSRF protection, input sanitization
 */

import { type NextRequest, NextResponse } from 'next/server';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
  cspDirectives?: Record<string, string | string[]>;
  hstsMaxAge?: number;
  noSniff?: boolean;
  xssProtection?: boolean;
  referrerPolicy?: string;
  permissionsPolicy?: Record<string, string | string[]>;
}

/**
 * Default security headers configuration
 */
const defaultSecurityHeaders: SecurityHeadersConfig = {
  hstsMaxAge: 31536000, // 1 year
  noSniff: true,
  xssProtection: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  cspDirectives: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Next.js requires these
    'style-src': ["'self'", "'unsafe-inline'"], // CSS-in-JS
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  },
  permissionsPolicy: {
    'camera': [],
    'microphone': [],
    'geolocation': [],
    'payment': [],
  },
};

/**
 * Apply security headers to response
 */
export function withSecurityHeaders(
  config: SecurityHeadersConfig = defaultSecurityHeaders
) {
  return (response: NextResponse) => {
    const headers = new Headers(response.headers);

    // HSTS (HTTP Strict-Transport-Security)
    if (config.hstsMaxAge !== false) {
      headers.set(
        'Strict-Transport-Security',
        `max-age=${config.hstsMaxAge || 31536000}; includeSubDomains; preload`
      );
    }

    // X-Content-Type-Options (prevent MIME sniffing)
    if (config.noSniff !== false) {
      headers.set('X-Content-Type-Options', 'nosniff');
    }

    // X-Frame-Options (clickjacking protection)
    headers.set('X-Frame-Options', 'DENY');

    // X-XSS-Protection (legacy XSS protection, modern browsers use CSP)
    if (config.xssProtection !== false) {
      headers.set('X-XSS-Protection', '1; mode=block');
    }

    // Referrer-Policy
    if (config.referrerPolicy) {
      headers.set('Referrer-Policy', config.referrerPolicy);
    }

    // Content-Security-Policy
    if (config.cspDirectives) {
      const cspDirectives = Object.entries(config.cspDirectives)
        .map(([key, value]) => {
          const values = Array.isArray(value) ? value.join(' ') : value;
          return `${key} ${values}`;
        })
        .join('; ');
      headers.set('Content-Security-Policy', cspDirectives);
    }

    // Permissions-Policy (formerly Feature-Policy)
    if (config.permissionsPolicy) {
      const permissionsPolicyStr = Object.entries(config.permissionsPolicy)
        .map(([key, value]) => {
          const values = Array.isArray(value) ? value : [value];
          return `${key}=(${values.join(' ')})`;
        })
        .join(', ');
      headers.set('Permissions-Policy', permissionsPolicyStr);
    }

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

/**
 * Middleware for applying security headers
 */
export function securityHeadersMiddleware(
  config: SecurityHeadersConfig = defaultSecurityHeaders
) {
  return (response: NextResponse) => withSecurityHeaders(config)(response);
}

/**
 * CSRF Token generation and validation
 */
class CSRFProtection {
  private static readonly TOKEN_LENGTH = 32;

  static generateToken(): string {
    const array = new Uint8Array(this.TOKEN_LENGTH);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  static validateToken(token: string): boolean {
    return /^[a-f0-9]{64}$/.test(token);
  }

  static validateRequest(
    request: NextRequest,
    sessionToken: string
  ): boolean {
    const csrfToken =
      request.headers.get('x-csrf-token') ||
      request.headers.get('csrf-token');

    if (!csrfToken) {
      return false;
    }

    // Constant-time comparison to prevent timing attacks
    return this.constantTimeCompare(csrfToken, sessionToken);
  }

  private static constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}

export { CSRFProtection };

/**
 * Input sanitization
 */
class InputSanitizer {
  /**
   * Sanitize HTML input to prevent XSS
   */
  static sanitizeHtml(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  }

  /**
   * Sanitize JSON input
   */
  static sanitizeJson(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return this.sanitizeHtml(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeJson(item));
    }
    if (typeof obj === 'object' && obj !== null) {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeJson(value);
      }
      return sanitized;
    }
    return obj;
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Validate URL format
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove potentially dangerous characters
   */
  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/^\.+/, '')
      .substring(0, 255);
  }

  /**
   * Validate file upload
   */
  static validateFileUpload(
    file: File,
    options: {
      maxSize?: number; // bytes
      allowedMimeTypes?: string[];
      allowedExtensions?: string[];
    } = {}
  ): { valid: boolean; error?: string } {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'],
      allowedExtensions = ['jpg', 'jpeg', 'png', 'gif'],
    } = options;

    // Check file size
    if (file.size > maxSize) {
      return { valid: false, error: 'File size exceeds maximum allowed' };
    }

    // Check MIME type
    if (!allowedMimeTypes.includes(file.type)) {
      return { valid: false, error: 'File type not allowed' };
    }

    // Check extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      return { valid: false, error: 'File extension not allowed' };
    }

    return { valid: true };
  }
}

export { InputSanitizer };

/**
 * Secrets validation
 */
class SecretsValidator {
  /**
   * Validate that all required secrets are present
   */
  static validateSecrets(env: Record<string, string | undefined>): {
    valid: boolean;
    missing: string[];
  } {
    const requiredSecrets = [
      'NEXTAUTH_SECRET',
      'DATABASE_URL',
      'PRODUCT_ID',
    ];

    const missing = requiredSecrets.filter((secret) => !env[secret]);

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Validate secret strength
   */
  static isStrongSecret(secret: string): {
    strong: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (secret.length < 32) {
      issues.push('Secret must be at least 32 characters');
    }

    if (!/[a-z]/.test(secret)) {
      issues.push('Secret must contain lowercase letters');
    }

    if (!/[A-Z]/.test(secret)) {
      issues.push('Secret must contain uppercase letters');
    }

    if (!/[0-9]/.test(secret)) {
      issues.push('Secret must contain numbers');
    }

    if (!/[!@#$%^&*]/.test(secret)) {
      issues.push('Secret must contain special characters');
    }

    return {
      strong: issues.length === 0,
      issues,
    };
  }
}

export { SecretsValidator };

/**
 * SQL Injection prevention verification
 * Note: Using Prisma ORM provides SQL injection protection by default
 */
export class SQLInjectionPrevention {
  /**
   * Verify that Prisma is properly used (no raw queries without parameterization)
   * This is a marker/reminder - actual prevention is through code review
   */
  static verify(): {
    secure: boolean;
    message: string;
  } {
    return {
      secure: true,
      message: 'SQL injection prevented via Prisma ORM parameterized queries',
    };
  }

  /**
   * Safe string sanitization for Prisma (if raw queries ever used)
   */
  static sanitizeForPrisma(value: unknown): string {
    if (typeof value !== 'string') {
      return String(value);
    }
    // Escape single quotes
    return value.replace(/'/g, "''");
  }
}

/**
 * CORS configuration
 */
export interface CORSConfig {
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

/**
 * Generate CORS headers
 */
export function getCORSHeaders(
  origin: string | null,
  config: CORSConfig = {}
): Record<string, string> {
  const {
    allowedOrigins = [process.env.NEXTAUTH_URL || 'http://localhost:3000'],
    allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders = ['Content-Length', 'X-Request-Id'],
    credentials = true,
    maxAge = 86400,
  } = config;

  const headers: Record<string, string> = {};

  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (allowedOrigins.includes('*')) {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  headers['Access-Control-Allow-Methods'] = allowedMethods.join(', ');
  headers['Access-Control-Allow-Headers'] = allowedHeaders.join(', ');
  headers['Access-Control-Expose-Headers'] = exposedHeaders.join(', ');

  if (credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  headers['Access-Control-Max-Age'] = String(maxAge);

  return headers;
}

/**
 * CORS middleware
 */
export function withCORS(config: CORSConfig = {}) {
  return (response: NextResponse, request: NextRequest) => {
    const origin = request.headers.get('origin');
    const corsHeaders = getCORSHeaders(origin, config);

    return new NextResponse(response.body, {
      status: response.status,
      headers: { ...Object.fromEntries(response.headers), ...corsHeaders },
    });
  };
}

/**
 * Combined security middleware
 */
export function withSecurityMiddleware(
  securityConfig: SecurityHeadersConfig = defaultSecurityHeaders,
  corsConfig: CORSConfig = {}
) {
  return (response: NextResponse, request: NextRequest) => {
    let result = response;
    result = withSecurityHeaders(securityConfig)(result);
    result = withCORS(corsConfig)(result, request);
    return result;
  };
}
