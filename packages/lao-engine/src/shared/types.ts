/**
 * Common types used across the engine.
 */

import { v4 as uuidv4 } from 'uuid';

export type UUID = string & { readonly __brand: 'UUID' };

export function createUUID(): UUID;
export function createUUID(id: string): UUID;
export function createUUID(id?: string): UUID {
  if (id === undefined) {
    // Generate new UUID
    return uuidv4() as UUID;
  }
  // Validate existing UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    throw new Error(`Invalid UUID: ${id}`);
  }
  return id as UUID;
}

export interface Pagination {
  limit: number;
  offset: number;
  total?: number;
}

export interface Result<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

export function failure<T>(code: string, message: string): Result<T> {
  return { success: false, error: { code, message } };
}

/**
 * Timestamp utilities.
 */
export function now(): string {
  return new Date().toISOString();
}

export function addHours(timestamp: string, hours: number): string {
  const date = new Date(timestamp);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

export function addDays(timestamp: string, days: number): string {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function daysSince(timestamp: string): number {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
