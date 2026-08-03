/**
 * ReasoningChain
 *
 * Complete trace of how a recommendation was generated.
 * Designed for exact reproducibility.
 *
 * Given:
 * - Event history
 * - Evidence
 * - Perspective
 * - Algorithm version
 * - Graph version
 * - Recommendation profile
 *
 * The engine must reproduce exactly the same recommendation.
 */

import { Context } from './Context';

export interface ReasoningStep {
  id: string;
  stepType:
    | 'goal_requires'
    | 'capability_requires'
    | 'skill_check'
    | 'mastery_threshold'
    | 'confidence_threshold'
    | 'prerequisite_check'
    | 'context_check'
    | 'evidence_evaluation'
    | 'claim_evaluation'
    | 'perspective_alignment';

  description: string;
  result: boolean | number | string;
  confidence: number; // 0-1: certainty of this step

  // Stable references
  nodeId?: string; // which skill/capability/goal? (stable ID)
  claimId?: string; // which relationship claim? (stable ID)

  evidenceIds: string[]; // what evidence supports this step?
  context?: Context;
  timestamp: string;

  // Explanation
  reasoning?: string; // why did this step produce this result?
}

export interface ReasoningChain {
  // Identity
  chainId: string;
  learnerId: string;
  tenantId: string;

  // Reference stable IDs, not mutable names
  goalNodeId?: string;
  capabilityNodeId?: string;
  skillNodeId?: string;

  // The recommendation
  recommendationText: string;
  reasoning: ReasoningStep[]; // ordered reasoning path
  finalRecommendation: string;
  recommendedAction: 'learn' | 'practice' | 'assess' | 'reinforce' | 'specialise' | 'move_to_context';
  priority: number; // 0-1: urgency

  // Reproducibility context
  graphVersion: string; // which graph version? (e.g., "1.2.3")
  beliefModelVersion: string; // which belief algorithm? (e.g., "belief-algorithm-v2.1.4")
  algorithmVersion: string; // which reasoning algorithm? (e.g., "recommendation-engine-v1.0")
  perspectiveId?: string; // which perspective? (null = multi-perspective)
  recommendationProfileId: string; // which optimization profile?

  // Temporal context
  snapshotTimestamp: string; // when was this generated?
  eventHistoryUpTo: string; // what event history was used?

  // Validity tracking
  createdAt: string;
  deprecatedAt?: string;
  invalidationReason?: string; // why is this reasoning outdated?

  // Methods
  canReproduceNow(currentGraphVersion: string, currentAlgorithmVersion: string): boolean;
  isStillValid(currentBeliefsMap: Map<string, number>): boolean; // are belief values still the same?
  getSummary(): string; // human-readable summary of reasoning
}
