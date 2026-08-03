/**
 * Capability
 *
 * Demonstrated ability to perform a task or role.
 * Distinct from Knowledge (understanding).
 *
 * Knowledge asks: "Do they understand this?"
 * Capability asks: "Can they actually do this?"
 *
 * Mastery levels differ:
 * - Knowledge: 60% = understands enough to build
 * - Capability: 70% = can reliably execute
 *
 * Evidence differs:
 * - Knowledge: assessments, reflections, questions, explanations
 * - Capability: projects, missions, practical tasks, peer review
 *
 * Both are essential. Neither is sufficient alone.
 */

import { Context } from './Context';

export interface CapabilityEvidence {
  evidenceId: string;
  type: 'project_completed' | 'mission_completed' | 'practical_task' | 'peer_review' | 'production_application';
  skillId: string;
  score: number; // 0-100: how well they executed
  timestamp: string;
  complexity: number; // 1-10: difficulty of what they demonstrated
  feedback?: string; // qualitative assessment
  verifiedBy: 'self' | 'peer' | 'mentor' | 'system';
  sourceReliability: number; // 0-1: how trustworthy this source
  weight: number; // heavier for complex, verified tasks
  context: Context;
  metadata?: Record<string, unknown>;
}

export interface CapabilityState {
  // Identity
  capabilityId: string;
  learnerId: string;
  skillId: string;
  tenantId: string;

  // Context binding - mandatory for capability
  primaryContext: Context;
  specialisationOf?: string; // capabilityId of parent

  // Mastery
  capabilityLevel: number; // 0-100 in primary context
  capabilityStage: 'incapable' | 'learning' | 'capable' | 'proficient' | 'expert';

  // Evidence
  evidence: CapabilityEvidence[];
  evidenceCount: number;

  // Confidence
  confidence: number; // 0-100: how confident we are in this capability level
  successRate: number; // 0-100: % of tasks completed successfully
  minComplexityDemonstrated: number; // highest complexity task completed

  // Prerequisites
  prerequisiteKnowledge: { skillId: string; minMastery: number; context: Context }[];
  prerequisiteCapabilities: { capabilityId: string; minLevel: number; context: Context }[];

  // Enablement
  enablesCapabilities: { capabilityId: string; context: Context }[];
  enablesGoals: { goalId: string; context: Context }[];

  // Decay
  decay: {
    lastDemonstrated: string;
    lastPractised: string;
    confidenceTrend: number[]; // recent confidence changes
    atrophyRate: number; // faster than knowledge decay
    reinforcementIntervalDays: number;
  };

  // Reasoning
  lastRecommendationReason?: string; // reasoningChainId

  // Metadata
  metadata?: Record<string, unknown>;
  version: number;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;

  // Methods
  withContext(context: Context): CapabilityState;
  withEvidence(evidence: CapabilityEvidence): CapabilityState;
  capabilityLevelByContext(context: Context): number;
  arePrerequisitesMet(): boolean;
  needsReinforcement(): boolean;
  validate(): string[]; // validation errors
}
