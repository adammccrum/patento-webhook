/**
 * GraphClaim
 *
 * An educational assertion in the knowledge graph.
 * Claims are supported by evidence but are not immutable facts.
 * Each claim has a lifecycle and can be challenged, verified, or superseded.
 *
 * Relationship types:
 * - depends_on: Skill A depends on Skill B
 * - strengthens: Skill A strengthens Skill B
 * - teaches: Resource teaches Skill
 * - assesses: Assessment assesses Skill
 * - demonstrates: Capability demonstrates Skill
 * - verified_by: Capability verified by Assessment
 * - reinforces: Mission reinforces Skill
 * - specialises: Capability specialises Capability
 * - equivalent_to: Skill equivalent to Skill
 * - supersedes: Technology supersedes Technology
 * - applicable_in: Skill applicable in Context
 * - required_for: Skill required for Goal
 * - enables: Capability enables Goal
 * - unlocks: Skill unlocks Capability
 * - prerequisite_for: Skill prerequisite for Capability
 */

import { Context } from './Context';
import type { EvidenceType } from './Belief';

export type RelationshipType =
  | 'depends_on'
  | 'strengthens'
  | 'teaches'
  | 'assesses'
  | 'demonstrates'
  | 'verified_by'
  | 'reinforces'
  | 'specialises'
  | 'equivalent_to'
  | 'supersedes'
  | 'applicable_in'
  | 'required_for'
  | 'enables'
  | 'unlocks'
  | 'prerequisite_for';

export type ClaimStatus = 'proposed' | 'verified' | 'active' | 'challenged' | 'deprecated' | 'superseded';

export interface ClaimSupport {
  supportId: string;
  type: EvidenceType;
  sourceId: string; // evidence ID, assessment ID, learner ID, etc
  description?: string;
  confidence: number; // 0-1: how strongly this evidence supports the claim
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface GraphGovernance {
  // Ownership
  createdBy: string; // user ID or system
  createdByRole: 'human_expert' | 'system' | 'learner_pattern';
  ownerTeam?: string; // e.g., "math-curriculum-team"

  // Approval chain
  derivedBy?: string; // if computed from other claims
  approvedBy?: string[]; // expert IDs who verified
  approvalTimestamps?: { approver: string; timestamp: string }[];
  requiresApproval?: boolean;
  isApproved: boolean;

  // Review governance
  reviewSchedule: 'never' | 'quarterly' | 'annually' | 'when_evidence_changes' | 'custom';
  reviewThreshold?: number; // e.g., 0.05 = review when evidence confidence changes >5%
  lastReviewedAt?: string;
  nextReviewDue?: string;
  reviewerAssigned?: string;

  // Change tracking
  auditHistory: Array<{
    action: 'created' | 'modified' | 'verified' | 'challenged' | 'approved' | 'reviewed' | 'superseded' | 'archived';
    actor: string;
    actorRole: string;
    timestamp: string;
    change?: string;
    evidence?: string[];
    approvalRequired: boolean;
  }>;

  // Rationale
  rationale?: string;
  dataClassification?: 'public' | 'internal' | 'research';

  // Escalation
  escalationPath?: string[];
  canBeOverridden: boolean;
  overrideRequires?: string[];
}

export interface GraphClaim {
  // Stable identity
  claimId: string;

  // Semantic content
  type: RelationshipType;
  fromNodeId: string; // stable reference
  toNodeId: string; // stable reference
  tenantId: string;

  // Claim lifecycle
  status: ClaimStatus;
  proposedAt: string;
  verifiedAt?: string;
  challengedAt?: string;
  deprecatedAt?: string;

  // Temporal validity
  valid_from: string; // when this relationship became true
  valid_until?: string; // when it stops being true
  discovered_at: string; // when added to knowledge graph
  superseded_at?: string; // when replaced by new claim
  superseded_by?: string; // claimId of replacement claim

  // Supporting evidence
  supportingEvidence: ClaimSupport[];

  // Context
  context?: Context; // some relationships context-specific

  // Perspective
  perspectiveId?: string; // which perspective made this claim?

  // Properties
  version: number;
  direction: 'one_way' | 'reciprocal';

  // Reasoning
  reasoning?: string; // why we believe this relationship

  // Governance
  governance: GraphGovernance;

  // Metadata
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;

  // Methods
  isValidAt(timestamp: string): boolean;
  isChallenged(): boolean;
  canSupersede(otherClaim: GraphClaim): boolean;
  getSupersessionChain(allClaims: GraphClaim[]): string[];
  getCurrent(allClaims: GraphClaim[]): GraphClaim | null;
}
