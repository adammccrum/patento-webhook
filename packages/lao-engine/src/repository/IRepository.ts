/**
 * Generic repository interface for data access.
 * Abstracts database details (PostgreSQL, MongoDB, etc).
 * All implementations must be database-agnostic.
 */
export interface IRepository<T> {
  /**
   * Find entity by ID.
   * Returns null if not found (not an error).
   */
  findById(id: string): Promise<T | null>;

  /**
   * Find multiple entities by IDs.
   */
  findByIds(ids: string[]): Promise<T[]>;

  /**
   * Save a new entity or update existing (upsert pattern).
   * Must be idempotent.
   */
  save(entity: T): Promise<void>;

  /**
   * Save multiple entities atomically (all or none).
   */
  saveBatch(entities: T[]): Promise<void>;

  /**
   * Delete entity by ID.
   * Safe to call if entity doesn't exist (no-op).
   */
  delete(id: string): Promise<void>;

  /**
   * Count total entities.
   */
  count(): Promise<number>;

  /**
   * Generic query interface for complex filtering.
   * Implementations define query syntax specific to their store.
   */
  query(criteria: unknown): Promise<T[]>;
}
