/**
 * GraphClaimService
 *
 * Creates and updates GraphClaim instances when KnowledgeState evidence changes.
 * Bridges the learner evidence flow into the knowledge graph.
 *
 * Responsibilities:
 * - Create new claims when evidence demonstrates skill
 * - Strengthen existing claims with additional evidence
 * - Map evidence types to claim relationship types
 * - Initialize claim status based on evidence type
 */

import { GraphClaim, Evidence } from '../domain';
import { ClaimSupport, RelationshipType } from '../domain/GraphClaim';
import { IGraphRepository } from '../repositories';
import { createUUID, now } from '../shared';
import { IEventBus } from '../events';

export class GraphClaimService {
  constructor(
    private graphRepository: IGraphRepository,
    private eventBus: IEventBus
  ) {}

  /**
   * Process evidence from KnowledgeState and create/strengthen GraphClaim.
   * Called when withEvidence() adds evidence to KnowledgeState.
   */
  async processEvidence(
    learnerId: string,
    skillNodeId: string,
    evidence: Evidence,
    tenantId: string
  ): Promise<GraphClaim> {
    // Determine claim relationship type based on evidence type
    const relationshipType = this.mapEvidenceTypeToClaim(evidence.type);

    // Try to find existing claim for this skill
    const existingClaims = await this.graphRepository.getClaimsByPerspective('default');
    const existingClaim = existingClaims.find(
      (c) =>
        c.fromNodeId === skillNodeId &&
        c.type === relationshipType &&
        c.tenantId === tenantId
    );

    if (existingClaim) {
      // Strengthen existing claim with new evidence
      return this.strengthenClaim(existingClaim, evidence, learnerId);
    }

    // Create new claim
    return this.createNewClaim(skillNodeId, evidence, relationshipType, learnerId, tenantId);
  }

  /**
   * Create a new GraphClaim from evidence.
   */
  private async createNewClaim(
    skillNodeId: string,
    evidence: Evidence,
    relationshipType: RelationshipType,
    learnerId: string,
    tenantId: string
  ): Promise<GraphClaim> {
    const claimId = createUUID();
    const timestamp = now();

    // Initial status: proposed for low-confidence evidence, active for high-confidence
    const confidence = evidence.confidence ?? 0.5;
    const status = confidence > 0.7 ? 'active' : 'proposed';

    const support: ClaimSupport = {
      supportId: createUUID(),
      type: evidence.type as any,
      sourceId: evidence.evidenceId,
      confidence,
      timestamp,
      metadata: evidence.metadata,
    };

    const claim: GraphClaim = {
      claimId,
      type: relationshipType,
      fromNodeId: skillNodeId,
      toNodeId: learnerId,
      status,
      proposedAt: timestamp,
      verifiedAt: confidence > 0.8 ? timestamp : undefined,
      valid_from: timestamp,
      discovered_at: timestamp,
      supportingEvidence: [support],
      tenantId,
      perspectiveId: 'default',
      version: 1,
      direction: 'one_way',
      governance: {
        createdBy: 'system',
        createdByRole: 'system',
        isApproved: confidence > 0.8,
        reviewSchedule: 'when_evidence_changes',
        canBeOverridden: false,
        auditHistory: [
          {
            action: 'created',
            actor: 'GraphClaimService',
            actorRole: 'system',
            timestamp,
            approvalRequired: false,
          },
        ],
      },
      createdAt: timestamp,
      updatedAt: timestamp,
      isValidAt: (ts: string) => new Date(ts) >= new Date(timestamp),
      isChallenged: () => (status as any) === 'challenged',
      canSupersede: () => true,
      getSupersessionChain: () => [claimId],
      getCurrent: () => claim,
    };

    // Persist claim
    await this.graphRepository.saveClaim(claim);

    // Publish event
    await this.eventBus.publish({
      eventId: createUUID(),
      eventType: 'GraphClaimCreated',
      aggregateId: claimId,
      aggregateType: 'GraphClaim',
      timestamp,
      tenantId,
      version: 1,
      data: {
        claimId,
        skillNodeId,
        learnerId,
        type: relationshipType,
        status,
        evidenceType: evidence.type,
        confidence,
      },
    } as any);

    return claim;
  }

  /**
   * Strengthen an existing claim with additional evidence.
   * Adds new support and updates status if confidence improves.
   */
  private async strengthenClaim(
    claim: GraphClaim,
    evidence: Evidence,
    learnerId: string
  ): Promise<GraphClaim> {
    const timestamp = now();
    const newConfidence = evidence.confidence ?? 0.5;

    // Add new support evidence
    const newSupport: ClaimSupport = {
      supportId: createUUID(),
      type: evidence.type as any,
      sourceId: evidence.evidenceId,
      confidence: newConfidence,
      timestamp,
      metadata: evidence.metadata,
    };

    claim.supportingEvidence.push(newSupport);

    // Calculate average confidence
    const avgConfidence =
      claim.supportingEvidence.reduce((sum, s) => sum + s.confidence, 0) /
      claim.supportingEvidence.length;

    // Upgrade status if confidence is high enough
    if (claim.status === 'proposed' && avgConfidence > 0.7) {
      claim.status = 'active';
    }

    claim.updatedAt = timestamp;

    // Record in governance trail
    claim.governance.auditHistory.push({
      action: 'modified',
      actor: 'GraphClaimService',
      actorRole: 'system',
      timestamp,
      evidence: [evidence.evidenceId],
      approvalRequired: false,
    });

    // Persist updated claim
    await this.graphRepository.saveClaim(claim);

    // Publish event
    await this.eventBus.publish({
      eventId: createUUID(),
      eventType: 'GraphClaimStrengthened',
      aggregateId: claim.claimId,
      aggregateType: 'GraphClaim',
      timestamp,
      tenantId: claim.tenantId,
      version: 2,
      data: {
        claimId: claim.claimId,
        previousStatus: claim.status,
        newStatus: claim.status,
        evidenceCount: claim.supportingEvidence.length,
        avgConfidence,
      },
    } as any);

    return claim;
  }

  /**
   * Map evidence type to graph claim relationship type.
   */
  private mapEvidenceTypeToClaim(
    evidenceType: Evidence['type']
  ): RelationshipType {
    switch (evidenceType) {
      case 'assessment_passed':
      case 'assessment_failed':
        return 'assesses';
      case 'mission_completed':
      case 'project_completed':
        return 'demonstrates';
      case 'question_answered':
        return 'verified_by';
      case 'reflection_completed':
        return 'teaches';
      case 'practical_verified':
        return 'demonstrates';
      default:
        return 'strengthens';
    }
  }
}
