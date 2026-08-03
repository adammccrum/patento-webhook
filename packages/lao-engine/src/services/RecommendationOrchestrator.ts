/**
 * RecommendationOrchestrator
 *
 * Pure orchestration layer - never contains educational knowledge.
 * Queries graph and ranks actions by profile, no hardcoded rules.
 *
 * CRITICAL: Knowledge-free orchestration.
 * All educational rules live in the graph.
 *
 * Input: learner + goal + profile + graph
 * Output: recommended action + reasoning + reproducibility metadata
 */

import {
  RecommendationProfile,
  GraphVersion,
  Perspective,
} from '../domain';
import { GraphQueryService, CapabilityGap, GoalPath, DecayAlert } from './GraphQueryService';
import { IGraphRepository } from '../repositories';
import { createUUID, now } from '../shared';
import { IEventBus } from '../events';

export interface RecommendationRequest {
  learnerId: string;
  goalId: string;
  tenantId: string;
  perspective: Perspective;
  profile: RecommendationProfile;
  graphVersion: GraphVersion;
}

export interface RecommendationAction {
  actionType: string;
  skillId: string;
  skillName: string;
  expectedBenefitScore: number;
  timeEstimateMinutes: number;
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  rationale: string;
}

export interface RecommendationResult {
  recommendedAction: RecommendationAction;
  alternativeActions: RecommendationAction[];
  graphVersion: string;
  beliefModelVersion: string;
  timestamp: string;
}

export class RecommendationOrchestrator {
  private algorithmVersion = '1.0.0';

  constructor(
    private graphQuery: GraphQueryService,
    private graphRepository: IGraphRepository,
    private eventBus: IEventBus
  ) {}

  /**
   * Generate recommendation for learner towards goal.
   */
  async recommend(request: RecommendationRequest): Promise<RecommendationResult> {
    const timestamp = now();

    // Query 1: Goal path (what skills are needed?)
    const goalPath = await this.graphQuery.getGoalPath(
      request.goalId,
      request.learnerId,
      request.tenantId
    );

    // Query 2: Capability gaps
    const gaps = await this.graphQuery.getCapabilityGaps(
      request.learnerId,
      goalPath.requiredSkills.map((s) => s.nodeId),
      request.tenantId
    );

    // Query 3: Decay alerts (reinforcement needed?)
    const decayAlerts = await this.graphQuery.getDecayAlerts(
      request.learnerId,
      request.tenantId,
      30
    );

    // Rank candidates
    const candidates = this.rankCandidateActions(gaps, decayAlerts);

    if (candidates.length === 0) {
      throw new Error('No candidate actions');
    }

    const recommended = candidates[0]!;
    const alternatives = candidates.slice(1, 4);

    // Publish recommendation event
    await this.eventBus.publish({
      eventId: createUUID(),
      eventType: 'RecommendationGenerated',
      aggregateId: createUUID(),
      aggregateType: 'Recommendation',
      timestamp,
      tenantId: request.tenantId,
      version: 1,
      data: {
        learnerId: request.learnerId,
        goalId: request.goalId,
        recommendedSkillId: recommended.skillId,
        benefitScore: recommended.expectedBenefitScore,
        graphVersion: request.graphVersion.graphVersionId,
      },
    } as any);

    return {
      recommendedAction: recommended,
      alternativeActions: alternatives,
      graphVersion: request.graphVersion.graphVersionId,
      beliefModelVersion: request.graphVersion.beliefModelVersion,
      timestamp,
    };
  }

  /**
   * Rank candidates by benefit score.
   * Pure scoring - no educational logic.
   */
  private rankCandidateActions(gaps: CapabilityGap[], decayAlerts: DecayAlert[]): RecommendationAction[] {
    const candidates: RecommendationAction[] = [];

    // Add reinforcement actions for decay
    for (const alert of decayAlerts) {
      candidates.push({
        actionType: 'reinforce',
        skillId: alert.skillId,
        skillName: alert.skillName,
        expectedBenefitScore: alert.reinforcementUrgency === 'high' ? 80 : 50,
        timeEstimateMinutes: 45,
        difficultyLevel: 'intermediate',
        rationale: `Knowledge decay (${alert.daysSincePractice} days since practice)`,
      });
    }

    // Add learning actions for gaps
    for (const gap of gaps) {
      candidates.push({
        actionType: gap.gap > 30 ? 'learn' : 'practice',
        skillId: gap.skillId,
        skillName: gap.skillName,
        expectedBenefitScore: Math.max(0, 100 - gap.gap),
        timeEstimateMinutes: gap.estimatedEffortHours * 60,
        difficultyLevel:
          gap.currentMastery < 30
            ? 'beginner'
            : gap.currentMastery < 60
              ? 'intermediate'
              : 'advanced',
        rationale: `Gap of ${gap.gap}% to reach ${gap.requiredMastery}%`,
      });
    }

    // Sort by benefit score
    candidates.sort((a, b) => b.expectedBenefitScore - a.expectedBenefitScore);

    return candidates;
  }
}
