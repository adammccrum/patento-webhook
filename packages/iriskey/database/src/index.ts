/**
 * IrisKey Platform - Database (Prisma) Singleton
 * Single shared instance across the entire application
 */

import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma instance
 * Never create multiple instances - this causes connection pool issues
 */
class Database {
  private static instance: PrismaClient;

  /**
   * Get or create the singleton Prisma instance
   */
  static getInstance(): PrismaClient {
    if (!Database.instance) {
      Database.instance = new PrismaClient({
        // Log queries in development
        ...(process.env.NODE_ENV === 'development' && {
          log: ['query', 'error', 'warn'],
        }),
      });

      // Handle graceful shutdown
      if (process.env.NODE_ENV !== 'production') {
        // In development, reuse the prisma instance
        const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
        if (!globalForPrisma.prisma) {
          globalForPrisma.prisma = Database.instance;
        }
      }
    }

    return Database.instance;
  }

  /**
   * Disconnect the database
   */
  static async disconnect(): Promise<void> {
    if (Database.instance) {
      await Database.instance.$disconnect();
      Database.instance = null as any;
    }
  }
}

/**
 * Get the singleton Prisma client
 * Use this everywhere instead of creating new PrismaClient()
 */
export function getPrisma(): PrismaClient {
  return Database.getInstance();
}

/**
 * Initialize database (optional - gets called automatically on first use)
 */
export function initializeDatabase(): PrismaClient {
  return Database.getInstance();
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  await Database.disconnect();
}

/**
 * Export for direct usage if needed
 */
export { Database };

/**
 * Default export
 */
export default getPrisma;

// Canonical seed content, shared with the app's re-seed endpoint.
export { COURSE_1 } from './seed-data';
