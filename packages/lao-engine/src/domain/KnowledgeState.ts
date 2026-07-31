import { v4 as uuidv4 } from 'uuid';

/**
 * Evidence of learning - the foundation of mastery determination.
 * Never awarded, always earned through demonstrable action.
 */
export interface Evidence {
  evidenceId: string;
  type: 'assessment_passed' | 'assessment_failed' | 'mission_completed' | 'project_completed' | 'ai_explanation' | 'hint_requested' | 'question_answered' | 'reflection_completed' | 'practical_verified';
  skillId: string;
  score: number; // 0-100
  timestamp: string; // ISO 8601
  confidence?: number; // Impact on confidence (0-1)
  weight: number; // How much this evidence matters (0-1)
  metadata?: Record<string, unknown>;
}

/**
 * Mastery stage progression.
 * Learner moves through these stages as evidence accumulates.
 */
export type MasteryStage = 'unfamiliar' | 'aware' | 'developing' | 'proficient' | 'expert';

/**
 * Knowledge decay tracking for spaced repetition.
 */
export interface DecayInfo {
  lastDemonstrated?: string; // ISO 8601
  lastPractised?: string; // ISO 8601
  confidenceTrend: number[]; // Recent confidence scores (last 5)
  retrievalSuccessRate: number; // 0-1
  decayScore: number; // 0-1, how much knowledge has faded
  reinforcementIntervalDays: number; // Recommended days until next practice
}

/**
 * Prerequisite tracking for this skill.
 */
export interface Prerequisite {
  skillId: string;
  mastery: number; // Required mastery level (0-100)
  currentMastery: number; // Learner's current mastery of this prerequisite
  isMet: boolean;
}

/**
 * KnowledgeState represents what a learner genuinely knows about a skill.
 * This is the cognitive core of LAO.
 * Mastery is inferred from evidence, never awarded.
 *
 * Core principle: Knowledge is evidence-based.
 */
export class KnowledgeState {
  readonly id: string;
  readonly learnerId: string;
  readonly skillId: string;

  // Mastery tracking
  readonly masteryLevel: number; // 0-100, calculated from evidence
  readonly masteryStage: MasteryStage; // Qualification of mastery
  readonly confidence: number; // 0-100, calibrated against success rate

  // Evidence foundation
  readonly evidence: Evidence[]; // All demonstrations of knowledge
  readonly evidenceCount: number; // Total evidence items

  // Misconceptions discovered and tracked
  readonly misconceptions: Array<{
    id: string;
    description: string;
    discoveredAt: string;
    correctionStatus: 'discovered' | 'addressed' | 'corrected';
    evidenceIds: string[];
    impactedBy: string[]; // Which evidence items revealed this
  }>;

  // Decay and reinforcement
  readonly decay: DecayInfo;

  // Prerequisites for this skill
  readonly prerequisites: Prerequisite[];
  readonly dependents: string[]; // Skills that depend on this one

  // Performance metrics
  readonly successRate: number; // Percentage of successful evidence
  readonly consistencyScore: number; // 0-100, consistency of performance
  readonly velocityTrend: number; // Trend in mastery progression

  // Temporal tracking
  readonly createdAt: string; // ISO 8601
  readonly updatedAt: string; // ISO 8601
  readonly archivedAt?: string; // ISO 8601, when knowledge became inactive

  readonly tenantId: string;

  constructor(data: {
    id: string;
    learnerId: string;
    skillId: string;
    masteryLevel: number;
    masteryStage: MasteryStage;
    confidence: number;
    evidence: Evidence[];
    evidenceCount: number;
    misconceptions: Array<{
      id: string;
      description: string;
      discoveredAt: string;
      correctionStatus: 'discovered' | 'addressed' | 'corrected';
      evidenceIds: string[];
      impactedBy: string[];
    }>;
    decay: DecayInfo;
    prerequisites: Prerequisite[];
    dependents: string[];
    successRate: number;
    consistencyScore: number;
    velocityTrend: number;
    createdAt: string;
    updatedAt: string;
    archivedAt?: string;
    tenantId: string;
  }) {
    this.id = data.id;
    this.learnerId = data.learnerId;
    this.skillId = data.skillId;
    this.masteryLevel = data.masteryLevel;
    this.masteryStage = data.masteryStage;
    this.confidence = data.confidence;
    this.evidence = data.evidence;
    this.evidenceCount = data.evidenceCount;
    this.misconceptions = data.misconceptions;
    this.decay = data.decay;
    this.prerequisites = data.prerequisites;
    this.dependents = data.dependents;
    this.successRate = data.successRate;
    this.consistencyScore = data.consistencyScore;
    this.velocityTrend = data.velocityTrend;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.archivedAt = data.archivedAt;
    this.tenantId = data.tenantId;
  }

  /**
   * Create a new KnowledgeState for a skill.
   */
  static create(data: {
    learnerId: string;
    skillId: string;
    tenantId: string;
  }): KnowledgeState {
    const now = new Date().toISOString();
    return new KnowledgeState({
      id: uuidv4(),
      learnerId: data.learnerId,
      skillId: data.skillId,
      masteryLevel: 0,
      masteryStage: 'unfamiliar',
      confidence: 0,
      evidence: [],
      evidenceCount: 0,
      misconceptions: [],
      decay: {
        confidenceTrend: [],
        retrievalSuccessRate: 0,
        decayScore: 0,
        reinforcementIntervalDays: 0,
      },
      prerequisites: [],
      dependents: [],
      successRate: 0,
      consistencyScore: 0,
      velocityTrend: 0,
      createdAt: now,
      updatedAt: now,
      tenantId: data.tenantId,
    });
  }

  /**
   * Record new evidence of learning.
   * This is the only way mastery increases.
   */
  withEvidence(evidence: Evidence): KnowledgeState {
    const newEvidence = [...this.evidence, evidence];

    // Calculate new mastery based on evidence
    const newMastery = this.calculateMastery(newEvidence);
    const newStage = this.determineMasteryStage(newMastery);
    const newConfidence = this.calculateConfidence(newEvidence);
    const newSuccessRate = this.calculateSuccessRate(newEvidence);
    const newConsistency = this.calculateConsistency(newEvidence);
    const newVelocity = this.calculateVelocityTrend(newEvidence);
    const newDecay = this.updateDecay(evidence);

    return new KnowledgeState({
      ...this,
      evidence: newEvidence,
      evidenceCount: newEvidence.length,
      masteryLevel: newMastery,
      masteryStage: newStage,
      confidence: newConfidence,
      successRate: newSuccessRate,
      consistencyScore: newConsistency,
      velocityTrend: newVelocity,
      decay: newDecay,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Record a discovered misconception.
   */
  withMisconception(data: {
    description: string;
    evidenceId: string;
    impactedBy: string[];
  }): KnowledgeState {
    const misconception = {
      id: uuidv4(),
      description: data.description,
      discoveredAt: new Date().toISOString(),
      correctionStatus: 'discovered' as const,
      evidenceIds: [data.evidenceId],
      impactedBy: data.impactedBy,
    };

    return new KnowledgeState({
      ...this,
      misconceptions: [...this.misconceptions, misconception],
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Mark a misconception as corrected.
   */
  withMisconceptionCorrected(misconceptionId: string): KnowledgeState {
    const updated = this.misconceptions.map((m) =>
      m.id === misconceptionId
        ? { ...m, correctionStatus: 'corrected' as const }
        : m
    );

    return new KnowledgeState({
      ...this,
      misconceptions: updated,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Update prerequisites for this skill.
   */
  withPrerequisites(prerequisites: Prerequisite[]): KnowledgeState {
    return new KnowledgeState({
      ...this,
      prerequisites,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Register skills that depend on this one.
   */
  withDependents(dependentIds: string[]): KnowledgeState {
    return new KnowledgeState({
      ...this,
      dependents: dependentIds,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Archive this knowledge state (learner moved on).
   */
  withArchived(): KnowledgeState {
    return new KnowledgeState({
      ...this,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Calculate mastery level from evidence (0-100).
   * Weighted by recency and type.
   */
  private calculateMastery(evidence: Evidence[]): number {
    if (evidence.length === 0) return 0;

    const now = new Date().getTime();
    const weights = evidence.map((e) => {
      const ageMs = now - new Date(e.timestamp).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const recencyWeight = Math.exp(-ageDays / 30); // Decay over 30 days
      return e.score * e.weight * recencyWeight;
    });

    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const sumWeights = evidence.reduce((a, e) => a + e.weight, 0);
    const recencySum = evidence.reduce((a, e) => {
      const ageMs = now - new Date(e.timestamp).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      return a + Math.exp(-ageDays / 30);
    }, 0);

    return Math.round(totalWeight / recencySum);
  }

  /**
   * Determine mastery stage from level.
   */
  private determineMasteryStage(level: number): MasteryStage {
    if (level === 0) return 'unfamiliar';
    if (level < 25) return 'aware';
    if (level < 50) return 'developing';
    if (level < 80) return 'proficient';
    return 'expert';
  }

  /**
   * Calculate confidence (0-100) based on evidence consistency.
   */
  private calculateConfidence(evidence: Evidence[]): number {
    if (evidence.length === 0) return 0;
    if (evidence.length < 3) return Math.min(evidence[0]?.confidence || 0, 30);

    const successCount = evidence.filter((e) => e.score >= 70).length;
    const successRate = successCount / evidence.length;
    const consistency = 1 - Math.abs(successRate - 0.5) * 2;

    return Math.round(successRate * 100 * consistency);
  }

  /**
   * Calculate success rate from evidence.
   */
  private calculateSuccessRate(evidence: Evidence[]): number {
    if (evidence.length === 0) return 0;
    const successes = evidence.filter((e) => e.score >= 70).length;
    return Math.round((successes / evidence.length) * 100);
  }

  /**
   * Calculate consistency score.
   */
  private calculateConsistency(evidence: Evidence[]): number {
    if (evidence.length < 2) return 0;

    const recent = evidence.slice(-5);
    const scores = recent.map((e) => e.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, s) => a + Math.pow(s - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    return Math.max(0, 100 - stdDev);
  }

  /**
   * Calculate velocity trend.
   */
  private calculateVelocityTrend(evidence: Evidence[]): number {
    if (evidence.length < 2) return 0;

    const recent = evidence.slice(-5);
    if (recent.length < 2) return 0;

    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));

    const firstAvg = firstHalf.reduce((a, e) => a + e.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, e) => a + e.score, 0) / secondHalf.length;

    return secondAvg - firstAvg;
  }

  /**
   * Update decay information based on new evidence.
   */
  private updateDecay(evidence: Evidence): DecayInfo {
    const now = new Date().toISOString();
    const recentConfidence = this.decay.confidenceTrend.slice(-4);

    let lastDemonstrated = this.decay.lastDemonstrated;
    if (evidence.type.includes('passed') || evidence.type.includes('completed') || evidence.type.includes('verified')) {
      lastDemonstrated = now;
    }

    let lastPractised = this.decay.lastPractised;
    if (evidence.type === 'question_answered' || evidence.type === 'practical_verified') {
      lastPractised = now;
    }

    const successRate = evidence.score >= 70 ? 1 : 0;
    const newRetrievalRate = this.decay.retrievalSuccessRate * 0.7 + successRate * 0.3;

    return {
      lastDemonstrated,
      lastPractised,
      confidenceTrend: [...recentConfidence, evidence.confidence || 0.5],
      retrievalSuccessRate: newRetrievalRate,
      decayScore: Math.max(0, this.decay.decayScore - 0.1), // Evidence decreases decay
      reinforcementIntervalDays: this.calculateReinforcementInterval(newRetrievalRate),
    };
  }

  /**
   * Calculate how many days until reinforcement is needed.
   * Based on Ebbinghaus forgetting curve.
   */
  private calculateReinforcementInterval(retrievalRate: number): number {
    if (retrievalRate < 0.5) return 1; // Daily if struggling
    if (retrievalRate < 0.7) return 3; // Every 3 days
    if (retrievalRate < 0.85) return 7; // Weekly
    if (retrievalRate < 0.95) return 14; // Bi-weekly
    return 30; // Monthly for expert level
  }

  /**
   * Check if prerequisites are met.
   */
  arePrerequisitesMet(): boolean {
    return this.prerequisites.every((p) => p.isMet);
  }

  /**
   * Check if reinforcement is needed.
   */
  needsReinforcement(): boolean {
    if (!this.decay.lastPractised) return true;

    const lastPracticeMs = new Date(this.decay.lastPractised).getTime();
    const nowMs = new Date().getTime();
    const daysSincePractice = (nowMs - lastPracticeMs) / (1000 * 60 * 60 * 24);

    return daysSincePractice >= this.decay.reinforcementIntervalDays;
  }

  /**
   * Validate knowledge state invariants.
   */
  validate(): void {
    if (!this.id) throw new Error('KnowledgeState id is required');
    if (!this.learnerId) throw new Error('LearnerId is required');
    if (!this.skillId) throw new Error('SkillId is required');
    if (this.masteryLevel < 0 || this.masteryLevel > 100) {
      throw new Error('Mastery level must be 0-100');
    }
    if (this.confidence < 0 || this.confidence > 100) {
      throw new Error('Confidence must be 0-100');
    }
    if (this.successRate < 0 || this.successRate > 100) {
      throw new Error('Success rate must be 0-100');
    }
  }
}
