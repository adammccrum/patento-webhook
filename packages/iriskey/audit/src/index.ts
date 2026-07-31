/**
 * IrisKey Platform - Audit Logging Service
 * Centralized, immutable audit logging for all operations
 */

import { PrismaClient } from '@prisma/client';
import { emitEvent, createEvent, EVENTS } from '@iriskey/events';
import type { AuditLogEntry, AuditAction } from '@iriskey/contracts';

export interface AuditLogOptions {
  userId: string;
  productId: string;
  action: string | AuditAction;
  resource: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Audit logging service
 */
class AuditService {
  private static instance: AuditService;
  private prisma: PrismaClient;

  private constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Initialize audit service
   */
  static initialize(prisma: PrismaClient): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService(prisma);
    }
    return AuditService.instance;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AuditService {
    if (!AuditService.instance) {
      throw new Error('AuditService not initialized. Call AuditService.initialize(prisma) first.');
    }
    return AuditService.instance;
  }

  /**
   * Log an audit event
   */
  async log(options: AuditLogOptions): Promise<AuditLogEntry> {
    const { userId, productId, action, resource, details, ipAddress, userAgent } = options;

    // Create audit log in database
    const auditLog = await this.prisma.auditLog.create({
      data: {
        userId,
        productId,
        action,
        resource,
        details: details || {},
        ipAddress,
        userAgent,
      },
    });

    // Emit corresponding event (without userId if it's not set)
    await emitEvent({
      id: `audit_${auditLog.id}`,
      type: `audit:${action}`,
      productId,
      userId: userId || undefined,
      timestamp: auditLog.createdAt,
      metadata: {
        resource,
        details,
        auditLogId: auditLog.id,
      },
    });

    return auditLog as AuditLogEntry;
  }

  /**
   * Log user registration
   */
  async logUserRegistered(
    userId: string,
    email: string,
    productId: string,
    ipAddress?: string
  ): Promise<AuditLogEntry> {
    return this.log({
      userId,
      productId,
      action: 'user_registered',
      resource: 'auth',
      details: { email },
      ipAddress,
    });
  }

  /**
   * Log user login
   */
  async logUserLoggedIn(
    userId: string,
    productId: string,
    provider: string = 'credentials',
    ipAddress?: string
  ): Promise<AuditLogEntry> {
    return this.log({
      userId,
      productId,
      action: 'user_logged_in',
      resource: 'auth',
      details: { provider },
      ipAddress,
    });
  }

  /**
   * Log email verification
   */
  async logEmailVerified(
    userId: string,
    email: string,
    productId: string
  ): Promise<AuditLogEntry> {
    return this.log({
      userId,
      productId,
      action: 'email_verified',
      resource: 'auth',
      details: { email },
    });
  }

  /**
   * Log password reset
   */
  async logPasswordReset(userId: string, productId: string): Promise<AuditLogEntry> {
    return this.log({
      userId,
      productId,
      action: 'password_reset',
      resource: 'auth',
    });
  }

  /**
   * Log profile update
   */
  async logProfileUpdated(
    userId: string,
    productId: string,
    fields: string[]
  ): Promise<AuditLogEntry> {
    return this.log({
      userId,
      productId,
      action: 'profile_updated',
      resource: 'profile',
      details: { fields },
    });
  }

  /**
   * Log settings update
   */
  async logSettingsUpdated(
    userId: string,
    productId: string,
    fields: string[]
  ): Promise<AuditLogEntry> {
    return this.log({
      userId,
      productId,
      action: 'settings_updated',
      resource: 'settings',
      details: { fields },
    });
  }

  /**
   * Log credits used
   */
  async logCreditsUsed(
    userId: string,
    productId: string,
    amount: number,
    reason: string
  ): Promise<AuditLogEntry> {
    return this.log({
      userId,
      productId,
      action: 'credits_used',
      resource: 'credits',
      details: { amount, reason },
    });
  }

  /**
   * Get audit logs for a user
   */
  async getUserLogs(
    userId: string,
    productId: string,
    limit: number = 10
  ): Promise<AuditLogEntry[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { userId, productId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs as AuditLogEntry[];
  }

  /**
   * Get audit logs for a product
   */
  async getProductLogs(
    productId: string,
    action?: string,
    limit: number = 100
  ): Promise<AuditLogEntry[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        productId,
        ...(action && { action }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs as AuditLogEntry[];
  }

  /**
   * Get audit logs for an action
   */
  async getActionLogs(
    productId: string,
    action: string,
    limit: number = 100
  ): Promise<AuditLogEntry[]> {
    return this.getProductLogs(productId, action, limit);
  }
}

/**
 * Initialize audit service with Prisma client
 */
export function initializeAudit(prisma: PrismaClient): AuditService {
  return AuditService.initialize(prisma);
}

/**
 * Get audit service instance
 */
export function getAuditService(): AuditService {
  return AuditService.getInstance();
}

/**
 * Log an audit entry
 */
export async function logAudit(options: AuditLogOptions): Promise<AuditLogEntry> {
  return getAuditService().log(options);
}

/**
 * Export AuditService class
 */
export { AuditService };
