/**
 * KnowledgeVersion
 *
 * Track successive versions of a concept.
 * Knowledge evolves over time.
 *
 * Examples:
 * - OAuth 1.0 → OAuth 2.0 → OAuth 2.1
 * - Python 2.x → Python 3.x
 * - React Class Components → React Hooks
 *
 * Each version is semantically distinct but related.
 * Learners need different skills depending on target version.
 * Historical queries can ask "what would we have taught in 2015?"
 */

import { Context } from './Context';

export interface KnowledgeVersion {
  nodeId: string; // the concept (e.g., "OAuth")
  versionNumber: string; // "1.0", "2.0", "2.1"
  name: string; // "OAuth 2.1"
  description: string;
  tenantId: string;

  // Succession
  previousVersion?: string; // versionNumber of predecessor
  nextVersion?: string; // versionNumber of successor
  supersedes: string[]; // versionNumbers it replaces

  // Temporal validity
  valid_from: string;
  valid_until?: string; // when superseded
  majorReleaseDate?: string;
  deprecated: boolean;

  // Semantic differences
  breakingChanges?: string[]; // what changed significantly?
  incompatibleWith?: string[]; // which versionNumbers are incompatible?
  canMigrateFrom?: string[]; // which versions can learners upgrade from?

  // Context specificity
  recommendedContexts: Context[]; // where should this version be taught?
  deprecatedContexts?: Context[]; // where is it obsolete?
  currentlyActiveContexts: Context[]; // where is this the standard?

  // Metadata
  metadata?: Record<string, unknown>;
  version: number;

  // Timestamps
  createdAt: string;
  archivedAt?: string;

  // Methods
  isCurrentVersion(): boolean;
  isDeprecated(): boolean;
  isValidAt(timestamp: string): boolean;
}
