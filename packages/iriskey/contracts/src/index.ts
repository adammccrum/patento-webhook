/**
 * IrisKey Platform - Shared Types & Contracts
 * Single source of truth for all DTOs, interfaces, and enums
 */

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// User & Session Types
export interface UserSession {
  user?: {
    id: string;
    email: string;
    name?: string;
    image?: string;
    emailVerified?: boolean;
  };
  expires?: string;
  productId?: string;
}

export interface UserProfile {
  userId: string;
  bio?: string;
  avatar?: string;
  timezone?: string;
  language?: string;
  onboardingCompleted?: boolean;
}

export interface UserSettings {
  userId: string;
  twoFactorEnabled: boolean;
  emailNotifications: boolean;
  darkMode: boolean;
  emailOnLogin?: boolean;
  emailOnSecurityAlert?: boolean;
}

export interface UserCredits {
  userId: string;
  balance: number;
  spent: number;
  monthlyReset: number;
  lastResetDate?: Date;
}

// Audit Log Types
export interface AuditLogEntry {
  id: string;
  userId: string;
  productId: string;
  action: string;
  resource: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export enum AuditAction {
  USER_REGISTERED = 'user_registered',
  USER_LOGGED_IN = 'user_logged_in',
  USER_LOGGED_OUT = 'user_logged_out',
  EMAIL_VERIFIED = 'email_verified',
  PASSWORD_RESET = 'password_reset',
  PROFILE_UPDATED = 'profile_updated',
  SETTINGS_UPDATED = 'settings_updated',
  CREDENTIALS_USED = 'credits_used',
  CREDENTIALS_ALLOCATED = 'credits_allocated',
  TWO_FACTOR_ENABLED = 'two_factor_enabled',
  TWO_FACTOR_DISABLED = 'two_factor_disabled',
  API_KEY_CREATED = 'api_key_created',
  API_KEY_DELETED = 'api_key_deleted',
  SUBSCRIPTION_CREATED = 'subscription_created',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  PAYMENT_RECEIVED = 'payment_received',
  AI_REQUEST_STARTED = 'ai_request_started',
  AI_REQUEST_COMPLETED = 'ai_request_completed',
}

// Request/Response DTOs
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ProfileUpdateRequest {
  name?: string;
  bio?: string;
  avatar?: string;
  timezone?: string;
  language?: string;
}

export interface SettingsUpdateRequest {
  twoFactorEnabled?: boolean;
  emailNotifications?: boolean;
  darkMode?: boolean;
  emailOnLogin?: boolean;
  emailOnSecurityAlert?: boolean;
}

// Configuration Types
export interface AppConfig {
  productId: string;
  productName: string;
  environment: 'development' | 'production' | 'test';
  isDevelopment: boolean;
  isProduction: boolean;
  baseUrl: string;
  apiBaseUrl: string;
  databaseUrl: string;
  redisUrl?: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  emailProvider?: string;
  storageProvider?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface DatabaseConfig {
  url: string;
  maxConnections?: number;
  minConnections?: number;
  connectionTimeoutMs?: number;
  poolIdleTimeoutMs?: number;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  passwordHashRounds: number;
  emailVerificationExpiresIn: number;
  passwordResetExpiresIn: number;
  sessionMaxAge: number;
  cookieMaxAge: number;
}

// Error Types
export enum ErrorCode {
  // Client errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  INVALID_TOKEN = 'INVALID_TOKEN',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',

  // Auth errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Server errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
}

// Feature Flag Types
export interface FeatureFlag {
  productId: string;
  name: string;
  enabled: boolean;
  metadata?: Record<string, unknown>;
}

// Provider Types
export enum ProviderType {
  LLM = 'llm',
  IMAGE = 'image',
  VIDEO = 'video',
  VOICE = 'voice',
  EMBEDDING = 'embedding',
  TRANSCRIPTION = 'transcription',
}

export enum ProviderHealth {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

export interface ProviderConfig {
  productId: string;
  name: string;
  type: ProviderType;
  enabled: boolean;
  priority: number;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
}

// Dashboard Types
export interface DashboardData {
  user: {
    id: string;
    email: string;
    name?: string;
    image?: string;
    emailVerified?: boolean;
    createdAt: Date;
  };
  profile: UserProfile | null;
  credits: {
    balance: number;
    monthlyAllocation: number;
    spent: number;
    remaining: number;
    percentUsed: number;
    lastResetDate?: Date;
  };
  settings: UserSettings | null;
  recentActivity: AuditLogEntry[];
  stats: {
    accountAge: number;
    isOnboarded: boolean;
  };
}

// Export validation schemas separately
export const VALIDATION_RULES = {
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
  },
  NAME: {
    MIN_LENGTH: 2,
    MAX_LENGTH: 100,
  },
  BIO: {
    MAX_LENGTH: 500,
  },
  EMAIL: {
    MAX_LENGTH: 255,
  },
};
