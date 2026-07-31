/**
 * SemanticNode
 *
 * A semantic entity in the knowledge graph.
 * Nodes have stable identities that survive refactoring.
 *
 * Types:
 * - Skill: procedural knowledge (e.g., "API design")
 * - Concept: theoretical knowledge (e.g., "REST principles")
 * - Capability: demonstrated ability (e.g., "Can build microservices")
 * - Goal: learner's target (e.g., "Become full-stack developer")
 * - Mission: structured learning activity
 * - Assessment: evaluation method
 * - Technology: tool or framework
 * - Resource: learning material
 * - Certificate: credential
 * - Context: learning environment
 */

import { Context } from './Context';

export type NodeType =
  | 'skill'
  | 'concept'
  | 'capability'
  | 'goal'
  | 'mission'
  | 'assessment'
  | 'technology'
  | 'resource'
  | 'certificate'
  | 'context';

export interface NodeNameHistory {
  name: string;
  changed_at: string;
  reason?: string;
}

export interface SemanticNode {
  // Stable identity
  nodeId: string; // UUID: survives renaming, reorganisation
  type: NodeType;
  tenantId: string;

  // Mutable properties
  name: string;
  description?: string;

  // History of mutations
  nameHistory: NodeNameHistory[];
  descriptionHistory: {
    description: string;
    changed_at: string;
    reason?: string;
  }[];

  // Temporal validity
  valid_from: string; // when this node became relevant
  valid_until?: string; // when it stops being relevant
  discovered_at: string; // when added to graph
  superseded_at?: string; // when replaced
  superseded_by?: string; // nodeId of replacement node

  // Context applicability
  applicableContexts: Context[];

  // Versioning
  version: number;

  // Metadata
  metadata?: Record<string, unknown>;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Methods
  isValidAt(timestamp: string): boolean;
  nameAt(timestamp: string): string | null;
  getSupersessionChain(allNodes: SemanticNode[]): string[];
  getCurrent(allNodes: SemanticNode[]): SemanticNode | null;
  withName(newName: string, reason?: string): SemanticNode;
  withDescription(newDescription: string, reason?: string): SemanticNode;
}
