/**
 * Context
 *
 * Knowledge and capability always exist within context.
 * A learner's mastery varies by context.
 *
 * Examples:
 * - Technology: "Python", "JavaScript"
 * - Domain: "Data Science", "Web Development"
 * - Industry: "Finance", "Healthcare"
 * - Role: "Backend Engineer", "Data Analyst"
 * - Environment: "Local Development", "Production"
 * - Difficulty: "Beginner", "Intermediate"
 * - Product: "AWS", "Azure"
 */

export type ContextType =
  | 'domain'
  | 'industry'
  | 'technology'
  | 'product'
  | 'framework'
  | 'role'
  | 'difficulty'
  | 'environment'
  | 'custom';

export type InheritanceMode = 'full' | 'partial' | 'none';

export interface Context {
  // Identity
  contextId: string;
  type: ContextType;
  name: string;
  description?: string;
  tenantId: string;

  // Hierarchy
  parentContextId?: string; // "Python" ← parent of "Python for data science"
  parentChain: string[]; // full ancestry
  childContextIds: string[]; // children of this context

  // Inheritance rules
  inheritanceMode: InheritanceMode;
  // 'full': child capability fully implies parent capability
  // 'partial': child evidence contributes to parent but not conclusive
  // 'none': completely separate contexts
  inheritanceWeight?: number; // 0-1: when partial, how much child evidence counts toward parent

  // Temporal validity
  valid_from: string;
  valid_until?: string;
  deprecated_at?: string;

  // Scope
  learnerId?: string; // context may be learner-specific
  isGlobal: boolean; // applies to all learners?

  // Metadata
  metadata?: Record<string, unknown>;
  version: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;

  // Methods
  isValidAt(timestamp: string): boolean;
  inheritsFrom(ancestor: Context): boolean;
  sharesAncestor(otherContext: Context): Context | null;
  isRelatedTo(otherContext: Context): boolean;
}
