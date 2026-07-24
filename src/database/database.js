/**
 * Database initialization and connection pooling
 * Supports PostgreSQL (production) and SQLite (development)
 */

const knex = require('knex');
const logger = require('../utils/logger');

let db = null;
let knexInstance = null;

/**
 * Initialize database connection
 * @param {string} databaseUrl - Connection string (postgresql://... or sqlite:...)
 * @param {object} options - Additional options
 * @returns {object} Knex instance
 */
function initializeDatabase(databaseUrl, options = {}) {
  if (knexInstance) {
    return knexInstance;
  }

  const isPostgres = databaseUrl?.startsWith('postgresql://') || databaseUrl?.startsWith('postgres://');
  const isSqlite = databaseUrl?.startsWith('sqlite:');

  let config;

  if (isPostgres) {
    config = {
      client: 'pg',
      connection: databaseUrl,
      pool: {
        min: parseInt(process.env.DATABASE_POOL_MIN || 2),
        max: parseInt(process.env.DATABASE_POOL_MAX || 10)
      },
      migrations: {
        directory: './src/database/migrations',
        extension: 'js',
        loadExtensions: ['.js']
      }
    };
    logger.info('Initializing PostgreSQL database');
  } else if (isSqlite) {
    config = {
      client: 'sqlite3',
      connection: {
        filename: databaseUrl.replace('sqlite:', '')
      },
      useNullAsDefault: true,
      migrations: {
        directory: './src/database/migrations',
        extension: 'js',
        loadExtensions: ['.js']
      }
    };
    logger.info('Initializing SQLite database');
  } else {
    throw new Error(`Unsupported database URL format: ${databaseUrl}`);
  }

  knexInstance = knex(config);
  db = knexInstance;

  return knexInstance;
}

/**
 * Run all pending migrations
 */
async function runMigrations() {
  if (!knexInstance) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }

  try {
    const [batchNo, log] = await knexInstance.migrate.latest();
    if (log.length > 0) {
      logger.info(`Executed ${log.length} migration(s):`);
      log.forEach(migration => logger.info(`  - ${migration}`));
    } else {
      logger.info('No pending migrations');
    }
  } catch (error) {
    logger.error(`Migration failed: ${error.message}`);
    throw error;
  }
}

/**
 * Rollback last migration batch
 */
async function rollbackMigrations() {
  if (!knexInstance) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }

  try {
    const [batchNo, log] = await knexInstance.migrate.rollback();
    if (log.length > 0) {
      logger.info(`Rolled back ${log.length} migration(s):`);
      log.forEach(migration => logger.info(`  - ${migration}`));
    } else {
      logger.info('Nothing to rollback');
    }
  } catch (error) {
    logger.error(`Rollback failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get database instance
 */
function getDatabase() {
  if (!knexInstance) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return knexInstance;
}

/**
 * Close database connection
 */
async function closeDatabase() {
  if (knexInstance) {
    await knexInstance.destroy();
    knexInstance = null;
    db = null;
    logger.info('Database connection closed');
  }
}

/**
 * Check database connection health
 */
async function checkHealth() {
  if (!knexInstance) {
    return { status: 'not_initialized' };
  }

  try {
    await knexInstance.raw('SELECT 1');
    return { status: 'healthy', connected: true };
  } catch (error) {
    return { status: 'unhealthy', connected: false, error: error.message };
  }
}

module.exports = {
  initializeDatabase,
  runMigrations,
  rollbackMigrations,
  getDatabase,
  closeDatabase,
  checkHealth
};
