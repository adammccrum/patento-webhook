/**
 * LAO - Database Client Singleton
 * Use this everywhere instead of creating new PrismaClient()
 */

import { getPrisma } from '@iriskey/database';

/**
 * Get the singleton Prisma client
 * This is the only way to access the database in LAO
 */
export const db = getPrisma();

/**
 * Default export
 */
export default db;
