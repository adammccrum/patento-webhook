/**
 * Belief
 *
 * The engine's current confidence in a claim.
 * Separate from the claim itself.
 * Evolves as evidence accumulates.
 *
 * A belief can change without the claim changing.
 * A claim can be superseded without invalidating historical beliefs.
 */

export type EvidenceType =
  | 'curriculum_review'
  | 'sme_assessment'
  | 'learning_analytics'
  | 'empirical_observation'
  | 'user_feedback'
  | 'theoretical_basis';

export interface BeliefCalculationDetail {
  algorithm: string; // e.g., "weighted-evidence-accumulation-v1.2"
  inputs: {
    supportingEvidenceCount: number;
    contradictingEvidenceCount: number;
    averageSupportConfidence: number; // mean confidence of supporting evidence
    sources: EvidenceType[]; // types of evidence used
    sampleSize: number; // how many learners/assessments
    timespan: string; // e.g., "12 months"
  };
  outputs: {
    confidence: number;
    uncertainty: number;
    credibilityIntervalLower: number;
    credibilityIntervalUpper: number;
  };
}

export interface ConfidenceHistoryEntry {
  confidence: number;
  uncertainty: number;
  timestamp: string;
  calculationVersion: string;
  reason?: string; // "new evidence added", "algorithm updated", "learner pattern discovered"
}

export interface Belief {
  // Identity
  beliefId: string;
  claimId: string; // stable reference to what we're expressing belief about
  tenantId: string;

  // Current assessment
  confidence: number; // 0-1: how confident in the claim?
  uncertainty: number; // 0-1: margin of error (for Bayesian credibility intervals)

  // Evidence assessment
  supportingEvidenceCount: number;
  contradictingEvidenceCount: number;
  netEvidenceWeight: number; // supporting - contradicting (can be negative)

  // Supporting evidence types
  evidenceSources: Set<EvidenceType>; // which kinds of evidence inform this?

  // Calculation metadata
  calculationVersion: string; // e.g., "belief-algorithm-v2.1.4"
  calculationDetails?: BeliefCalculationDetail;
  lastRecalculated: string;

  // History for reproducibility
  confidenceHistory: ConfidenceHistoryEntry[]; // how has this belief evolved?

  // Versioning
  version: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Methods
  isStrongBelief(): boolean; // confidence > 0.75?
  isWeakBelief(): boolean; // confidence < 0.5?
  isHighlyUncertain(): boolean; // uncertainty > 0.2?

  confidenceAt(timestamp: string): number | null; // what was confidence then?
  canReproduceAt(timestamp: string, algorithmVersion: string): boolean;

  withNewEvidence(
    supportingCount: number,
    contradictingCount: number,
    newCalculationVersion: string,
    details?: BeliefCalculationDetail
  ): Belief;

  getCredibilityInterval(): { lower: number; upper: number };
  getTrend(): 'increasing' | 'decreasing' | 'stable'; // based on recent history
}
