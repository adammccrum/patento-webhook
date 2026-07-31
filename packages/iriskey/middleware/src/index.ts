/**
 * IrisKey Platform - Middleware Utilities
 * Reusable middleware for Next.js API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { ApiResponse, ApiError, UserSession, ErrorCode } from '@iriskey/contracts';
import { getProductId } from '@iriskey/config';

/**
 * Standard API response builder
 */
export class ApiResponseBuilder {
  /**
   * Create a success response
   */
  static success<T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> {
    return {
      success: true,
      data,
      meta,
    };
  }

  /**
   * Create an error response
   */
  static error(code: string, message: string, details?: Record<string, unknown>): ApiResponse<never> {
    return {
      success: false,
      error: {
        code,
        message,
        details,
      },
    };
  }

  /**
   * Create a paginated response
   */
  static paginated<T>(
    items: T[],
    page: number,
    limit: number,
    total: number
  ): ApiResponse<T[]> {
    return {
      success: true,
      data: items,
      meta: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    };
  }
}

/**
 * API error response with status code
 */
export class ApiErrorResponse {
  constructor(
    readonly code: string,
    readonly message: string,
    readonly status: number = 400,
    readonly details?: Record<string, unknown>
  ) {}

  toJSON(): ApiResponse<never> {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }

  toResponse(): NextResponse {
    return NextResponse.json(this.toJSON(), { status: this.status });
  }
}

/**
 * Create NextResponse from ApiResponse
 */
export function toResponse<T>(data: ApiResponse<T>, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Create error response
 */
export function errorResponse(code: string, message: string, status: number = 400): NextResponse {
  return NextResponse.json(
    ApiResponseBuilder.error(code, message),
    { status }
  );
}

/**
 * Validation error response
 */
export function validationError(message: string, details?: Record<string, unknown>): NextResponse {
  return NextResponse.json(
    ApiResponseBuilder.error('VALIDATION_ERROR', message, details),
    { status: 400 }
  );
}

/**
 * Authentication error response
 */
export function authError(message: string = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    ApiResponseBuilder.error('UNAUTHORIZED', message),
    { status: 401 }
  );
}

/**
 * Authorization error response
 */
export function forbiddenError(message: string = 'Forbidden'): NextResponse {
  return NextResponse.json(
    ApiResponseBuilder.error('FORBIDDEN', message),
    { status: 403 }
  );
}

/**
 * Not found error response
 */
export function notFoundError(resource: string = 'Resource'): NextResponse {
  return NextResponse.json(
    ApiResponseBuilder.error('NOT_FOUND', `${resource} not found`),
    { status: 404 }
  );
}

/**
 * Server error response
 */
export function serverError(message: string = 'Internal server error'): NextResponse {
  return NextResponse.json(
    ApiResponseBuilder.error('INTERNAL_SERVER_ERROR', message),
    { status: 500 }
  );
}

/**
 * Rate limit error response
 */
export function rateLimitError(retryAfter?: number): NextResponse {
  const response = NextResponse.json(
    ApiResponseBuilder.error('RATE_LIMIT_EXCEEDED', 'Too many requests'),
    { status: 429 }
  );
  if (retryAfter) {
    response.headers.set('Retry-After', retryAfter.toString());
  }
  return response;
}

/**
 * Route handler context
 */
export interface RouteContext {
  productId: string;
  userId?: string;
  session?: UserSession;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Route handler type
 */
export type RouteHandler = (req: NextRequest, ctx: RouteContext) => Promise<NextResponse>;

/**
 * Validate request body with Zod schema
 */
export async function validateRequest<T>(
  req: NextRequest,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: NextResponse }> {
  try {
    const body = await req.json();
    const validation = schema.safeParse(body);

    if (!validation.success) {
      const message = validation.error.errors[0]?.message || 'Validation failed';
      return {
        success: false,
        error: validationError(message),
      };
    }

    return {
      success: true,
      data: validation.data,
    };
  } catch (err) {
    return {
      success: false,
      error: validationError('Invalid JSON body'),
    };
  }
}

/**
 * Error handler wrapper for route handlers
 */
export function withErrorHandler(handler: RouteHandler): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    try {
      const ctx: RouteContext = {
        productId: getProductId(),
        ipAddress: req.headers.get('x-forwarded-for') || req.ip,
        userAgent: req.headers.get('user-agent') || undefined,
      };

      return await handler(req, ctx);
    } catch (error) {
      console.error('API error:', error);

      if (error instanceof ApiErrorResponse) {
        return error.toResponse();
      }

      if (error instanceof z.ZodError) {
        const message = error.errors[0]?.message || 'Validation failed';
        return validationError(message);
      }

      if (error instanceof Error) {
        if (error.message.includes('Unauthorized')) {
          return authError(error.message);
        }
        if (error.message.includes('Forbidden')) {
          return forbiddenError(error.message);
        }
        if (error.message.includes('Not found')) {
          return notFoundError();
        }
      }

      return serverError('An unexpected error occurred');
    }
  };
}

/**
 * Authentication middleware
 */
export async function requireAuth(req: NextRequest): Promise<{ userId: string; session: UserSession } | null> {
  // This is a placeholder - actual auth will be injected from the app
  // The auth.ts file in the app will provide the session
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return null;
  }

  // In a real implementation, this would validate the JWT token
  // For now, we'll assume it's handled by NextAuth middleware
  return null;
}

/**
 * Extract query parameters with validation
 */
export function getQueryParams(
  req: NextRequest,
  schema: z.ZodSchema
): { success: true; data: any } | { success: false; error: NextResponse } {
  const searchParams = req.nextUrl.searchParams;
  const params: Record<string, any> = {};

  searchParams.forEach((value, key) => {
    // Handle array parameters (e.g., ?ids=1&ids=2)
    if (params[key]) {
      if (Array.isArray(params[key])) {
        params[key].push(value);
      } else {
        params[key] = [params[key], value];
      }
    } else {
      params[key] = value;
    }
  });

  const validation = schema.safeParse(params);
  if (!validation.success) {
    const message = validation.error.errors[0]?.message || 'Invalid query parameters';
    return {
      success: false,
      error: validationError(message),
    };
  }

  return {
    success: true,
    data: validation.data,
  };
}

/**
 * Get request IP address
 */
export function getIpAddress(req: NextRequest): string {
  return req.headers.get('x-forwarded-for') || req.ip || 'unknown';
}

/**
 * Get request user agent
 */
export function getUserAgent(req: NextRequest): string {
  return req.headers.get('user-agent') || 'unknown';
}

/**
 * Create route context
 */
export function createRouteContext(req: NextRequest, userId?: string): RouteContext {
  return {
    productId: getProductId(),
    userId,
    ipAddress: getIpAddress(req),
    userAgent: getUserAgent(req),
  };
}

/**
 * Export ApiResponseBuilder for convenience
 */
export { ApiResponseBuilder as Response };
