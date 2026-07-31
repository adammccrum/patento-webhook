/**
 * GraphQueryService
 *
 * Query layer for the knowledge graph.
 * Provides semantic queries that support recommendation generation.
 *
 * Separates graph navigation (this service) from recommendation logic.
 * RecommendationOrchestrator consumes these queries only.
 *
 * Core queries:
 * - getSkillsForGoal: What skills are needed to reach this goal?
 * - getCapabilityGaps: What can't this learner do yet?
 * - getPrerequisiteChain: What must be learned first?
 * - getStrengthAreas: What is this learner strong in?
 * - getDecayAreas: What needs reinforcement?
 * - getMasteryProgression: How has mastery evolved?
 */

import { GraphClaim, SemanticNode, Belief, Context } from '../domain';
import { IGraphRepository } from '../repositories';

export interface SkillNode {
  nodeId: string;
  name: string;
  type: 'skill' | 'concept' | 'capability';
  masteryRequired: number; // 0-100
}

export interface CapabilityGap {
  skillId: string;
  skillName: string;
  currentMastery: number;
  requiredMastery: number;
  gap: number;
  prerequisiteSkills: string[];
  estimatedEffortHours: number;
}

export interface GoalPath {
  goalId: string;
  goalName: string;
  requiredSkills: SkillNode[];
  recommendedSequence: string[]; // skillIds in order
  estimatedDurationDays: number;
  prerequisites: string[];
}

export interface LearnersStrengthProfile {
  learnerId: string;
  strongSkills: SkillNode[];
  developingSkills: SkillNode[];
  weakSkills: SkillNode[];
  readyForAdvanced: boolean;
}

export interface DecayAlert {
  skillId: string;
  skillName: string;
  daysSincePractice: number;
  currentMastery: number;
  estimatedMasteryAfterDecay: number;
  reinforcementUrgency: 'low' | 'medium' | 'high';
}

export class GraphQueryService {
  constructor(private graphRepository: IGraphRepository) {}

  /**
   * Get all skills required for a goal.
   * Traverses "requires", "enables", "prerequisite_for" relationships.
   */
  async getSkillsForGoal(goalNodeId: string, tenantId: string): Promise<SkillNode[]> {
    const skills: SkillNode[] = [];
    const visited = new Set<string>();

    const traverse = async (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = await this.graphRepository.getNodeById(nodeId);
      if (!node) return;

      if (node.type === 'skill' || node.type === 'capability') {
        skills.push({
          nodeId: node.nodeId,
          name: node.name,
          type: node.type,
          masteryRequired: 70, // Default mastery threshold
        });
      }

      // Follow prerequisite and enablement relationships
      const claims = await this.graphRepository.getClaimsInvolvingNode(nodeId);
      for (const claim of claims) {
        if (
          claim.tenantId === tenantId &&
          (claim.type === 'prerequisite_for' ||
            claim.type === 'depends_on' ||
            claim.type === 'enables')
        ) {
          const nextId =
            claim.fromNodeId === nodeId ? claim.toNodeId : claim.fromNodeId;
          await traverse(nextId);
        }
      }
    };

    await traverse(goalNodeId);
    return skills;
  }

  /**
   * Identify capability gaps for a learner on a skill.
   * Compares learner's current mastery against required mastery.
   */
  async getCapabilityGaps(
    learnerId: string,
    skillIds: string[],
    tenantId: string
  ): Promise<CapabilityGap[]> {
    const gaps: CapabilityGap[] = [];

    for (const skillId of skillIds) {
      const skillNode = await this.graphRepository.getNodeById(skillId);
      if (!skillNode) continue;

      // Query beliefs about this learner's mastery
      // Simplified: check for demonstrated capability claims
      const demonstrationClaims = await this.graphRepository.getClaimsBetween(
        skillId,
        learnerId
      );

      const hasDemonstrated = demonstrationClaims.some((c) => c.status === 'active');
      const currentMastery = hasDemonstrated ? 50 : 0; // Simplified estimate

      const requiredMastery = 70;
      const gap = Math.max(0, requiredMastery - currentMastery);

      if (gap > 0) {
        gaps.push({
          skillId,
          skillName: skillNode.name,
          currentMastery,
          requiredMastery,
          gap,
          prerequisiteSkills: await this.getPrerequisitesFor(skillId, tenantId),
          estimatedEffortHours: Math.ceil(gap * 0.5), // Rough estimate
        });
      }
    }

    return gaps;
  }

  /**
   * Get prerequisites for a skill.
   * Traverses "prerequisite_for" relationships backwards.
   */
  async getPrerequisitesFor(skillId: string, tenantId: string): Promise<string[]> {
    const prerequisites: string[] = [];
    const visited = new Set<string>();

    const traverse = async (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const claims = await this.graphRepository.getClaimsInvolvingNode(nodeId);
      for (const claim of claims) {
        if (
          claim.tenantId === tenantId &&
          claim.type === 'prerequisite_for' &&
          claim.toNodeId === nodeId
        ) {
          prerequisites.push(claim.fromNodeId);
          await traverse(claim.fromNodeId);
        }
      }
    };

    await traverse(skillId);
    return prerequisites;
  }

  /**
   * Get recommended learning sequence for a goal.
   * Orders skills by prerequisite relationships and effort.
   */
  async getGoalPath(
    goalNodeId: string,
    learnerId: string,
    tenantId: string
  ): Promise<GoalPath> {
    const goalNode = await this.graphRepository.getNodeById(goalNodeId);
    if (!goalNode) {
      throw new Error(`Goal not found: ${goalNodeId}`);
    }

    const requiredSkills = await this.getSkillsForGoal(goalNodeId, tenantId);

    // Topological sort by prerequisites
    const recommendedSequence = await this.topologicalSort(
      requiredSkills.map((s) => s.nodeId),
      tenantId
    );

    return {
      goalId: goalNodeId,
      goalName: goalNode.name,
      requiredSkills,
      recommendedSequence,
      estimatedDurationDays: Math.ceil(requiredSkills.length * 14), // ~2 weeks per skill
      prerequisites: await this.getPrerequisitesFor(goalNodeId, tenantId),
    };
  }

  /**
   * Get learner's current strength profile.
   * Classifies skills as strong, developing, or weak.
   */
  async getLearnersStrengthProfile(
    learnerId: string,
    tenantId: string
  ): Promise<LearnersStrengthProfile> {
    const strongSkills: SkillNode[] = [];
    const developingSkills: SkillNode[] = [];
    const weakSkills: SkillNode[] = [];

    // Query all demonstrated capability claims
    const allSkillNodes = await this.graphRepository.getNodesByType('skill', tenantId);

    for (const node of allSkillNodes) {
      const claims = await this.graphRepository.getClaimsBetween(node.nodeId, learnerId);
      const masteryEstimate = claims.length > 0 ? claims.length * 20 : 0; // Rough estimate

      const skill: SkillNode = {
        nodeId: node.nodeId,
        name: node.name,
        type: 'skill',
        masteryRequired: 70,
      };

      if (masteryEstimate >= 70) {
        strongSkills.push(skill);
      } else if (masteryEstimate >= 40) {
        developingSkills.push(skill);
      } else {
        weakSkills.push(skill);
      }
    }

    return {
      learnerId,
      strongSkills,
      developingSkills,
      weakSkills,
      readyForAdvanced: strongSkills.length >= 3,
    };
  }

  /**
   * Identify skills that need reinforcement due to knowledge decay.
   * Assumes claim.metadata tracks last practice date.
   */
  async getDecayAlerts(
    learnerId: string,
    tenantId: string,
    thresholdDays: number = 30
  ): Promise<DecayAlert[]> {
    const alerts: DecayAlert[] = [];
    const now = new Date();

    const allSkillNodes = await this.graphRepository.getNodesByType('skill', tenantId);

    for (const node of allSkillNodes) {
      const claims = await this.graphRepository.getClaimsBetween(node.nodeId, learnerId);

      for (const claim of claims) {
        if (!claim.metadata?.lastPracticed) continue;

        const lastPracticed = new Date(claim.metadata.lastPracticed as string);
        const daysSincePractice = Math.floor(
          (now.getTime() - lastPracticed.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSincePractice > thresholdDays) {
          // Estimate mastery decay using exponential model
          const masteryAtPractice = (claim.metadata.masteryAtPractice as number) || 70;
          const decayFactor = Math.exp(-(daysSincePractice - thresholdDays) / 60); // 60-day half-life
          const estimatedMastery = Math.ceil(masteryAtPractice * decayFactor);

          const urgency =
            daysSincePractice > 90 ? 'high' : daysSincePractice > 60 ? 'medium' : 'low';

          alerts.push({
            skillId: node.nodeId,
            skillName: node.name,
            daysSincePractice,
            currentMastery: masteryAtPractice,
            estimatedMasteryAfterDecay: estimatedMastery,
            reinforcementUrgency: urgency,
          });
        }
      }
    }

    return alerts.sort((a, b) => b.daysSincePractice - a.daysSincePractice);
  }

  /**
   * Topological sort of skills by prerequisite relationships.
   * Returns skills in order: prerequisites first.
   */
  private async topologicalSort(skillIds: string[], tenantId: string): Promise<string[]> {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = async (nodeId: string) => {
      if (visited.has(nodeId)) return;
      if (visiting.has(nodeId)) return; // Cycle detection

      visiting.add(nodeId);

      const prerequisites = await this.getPrerequisitesFor(nodeId, tenantId);
      for (const prereqId of prerequisites) {
        if (skillIds.includes(prereqId)) {
          await visit(prereqId);
        }
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      sorted.push(nodeId);
    };

    for (const skillId of skillIds) {
      await visit(skillId);
    }

    return sorted;
  }
}
