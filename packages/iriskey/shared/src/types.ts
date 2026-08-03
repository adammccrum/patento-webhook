/**
 * Shared types across LAO packages
 */

/**
 * API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Pagination options
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * User session data
 */
export interface UserSession {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  provider?: string;
  emailVerified?: Date | null;
}

/**
 * Authentication error types
 */
export enum AuthError {
  INVALID_CREDENTIALS = 'invalid_credentials',
  USER_NOT_FOUND = 'user_not_found',
  USER_ALREADY_EXISTS = 'user_already_exists',
  EMAIL_NOT_VERIFIED = 'email_not_verified',
  TOKEN_EXPIRED = 'token_expired',
  INVALID_TOKEN = 'invalid_token',
  UNAUTHORIZED = 'unauthorized',
  FORBIDDEN = 'forbidden',
}

/**
 * Environment configuration
 */
export interface EnvConfig {
  DATABASE_URL: string;
  NEXTAUTH_SECRET: string;
  NEXTAUTH_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  REDIS_URL?: string;
  NODE_ENV: 'development' | 'staging' | 'production';
}
