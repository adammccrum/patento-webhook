/**
 * RecommendationProfile
 *
 * Defines an optimization strategy for recommendations.
 * The graph remains unchanged; only the profile changes.
 *
 * Enables multiple optimization strategies:
 * - Fastest route
 * - Deep understanding
 * - Exam preparation
 * - Job readiness
 * - Professional certification
 * - Confidence rebuilding
 * - Knowledge retention
 */

export type OptimizationObjective =
  | 'learning_velocity'
  | 'comprehensiveness'
  | 'employability'
  | 'certification'
  | 'confidence'
  | 'retention'
  | 'engagement';

export interface OptimizationWeights {
  learningVelocity?: number; // 0-1: prioritize speed
  comprehensiveness?: number; // 0-1: prioritize depth
  employability?: number; // 0-1: prioritize job skills
  certification?: number; // 0-1: prioritize exam readiness
  confidence?: number; // 0-1: prioritize confidence building
  retention?: number; // 0-1: prioritize long-term memory
  engagement?: number; // 0-1: prioritize enjoyment
}

export interface ProfileConstraint {
  maxTimePerWeek?: number; // hours
  maxCognitiveLoad?: number; // 0-100 scale
  mustInclude?: string[]; // nodeIds that must be covered
  mustExclude?: string[]; // nodeIds to skip
  preferredContexts?: string[]; // contextIds to prioritize
  availableContexts?: string[]; // contextIds accessible to learner
}

export interface RecommendationProfile {
  profileId: string;
  tenantId: string;

  // Identity
  name: string; // "Fastest Route", "Deep Understanding"
  description: string;

  // Optimization strategy
  objectives: OptimizationWeights;

  // Perspective alignment
  perspectiveId?: string; // which educational viewpoint to use?
  // if null, use all perspectives

  // Constraints
  constraints?: ProfileConstraint;

  // Versioning
  version: number;

  // Metadata
  isDefault: boolean; // is this the default profile?
  createdAt: string;
  updatedAt: string;
  deprecatedAt?: string;

  // Methods
  primaryObjective(): OptimizationObjective;
  satisfiesConstraints(learnerState: { timeAvailable: number; cognitiveCapacity: number }): boolean;
}

// Preset profile data
export const PRESET_PROFILE_DATA = {
  FASTEST_ROUTE: (tenantId: string) => ({
    tenantId,
    name: 'Fastest Route',
    description: 'Minimal path to goal achievement',
    objectives: { learningVelocity: 1.0, employability: 0.3 },
    constraints: { maxTimePerWeek: 10 },
    isDefault: false,
  }),

  DEEP_UNDERSTANDING: (tenantId: string) => ({
    tenantId,
    name: 'Deep Understanding',
    description: 'Comprehensive mastery with theory and practice',
    objectives: { comprehensiveness: 1.0, retention: 0.8, confidence: 0.6 },
    isDefault: false,
  }),

  EXAM_PREPARATION: (tenantId: string) => ({
    tenantId,
    name: 'Exam Preparation',
    description: 'Focused on certification exam success',
    objectives: { certification: 1.0, learningVelocity: 0.7 },
    constraints: { maxTimePerWeek: 15 },
    isDefault: false,
  }),

  JOB_READINESS: (tenantId: string) => ({
    tenantId,
    name: 'Job Readiness',
    description: 'Skills required for employment in target role',
    objectives: { employability: 1.0, comprehensiveness: 0.6, confidence: 0.7 },
    isDefault: false,
  }),

  CONFIDENCE_REBUILDING: (tenantId: string) => ({
    tenantId,
    name: 'Confidence Rebuilding',
    description: 'Focus on building confidence through achievable wins',
    objectives: { confidence: 1.0, engagement: 0.8, learningVelocity: 0.4 },
    isDefault: false,
  }),

  KNOWLEDGE_RETENTION: (tenantId: string) => ({
    tenantId,
    name: 'Knowledge Retention',
    description: 'Long-term memory consolidation through spaced repetition',
    objectives: { retention: 1.0, comprehensiveness: 0.5 },
    isDefault: false,
  }),
};
