/**
 * BeliefRecalculationService
 *
 * Recalculates Belief from graph evidence.
 * Makes the graph the authoritative source of learning truth.
 *
 * A Belief is confidence in a Claim:
 * - Claim: "This learner demonstrates Python mastery" (assertion)
 * - Belief: 0.82 confidence in that claim (versioned)
 *
 * When evidence changes, belief updates independently via graph queries.
 * This separation enables:
 * - Multiple belief models
 * - Historical replay
 * - Temporal reasoning ("what would we believe at time T?")
 */

import { Belief, GraphClaim } from '../domain';
import { BeliefCalculationDetail } from '../domain/Belief';
import { IGraphRepository } from '../repositories';
import { createUUID, now } from '../shared';
import { IEventBus } from '../events';

export class BeliefRecalculationService {
  private calculationVersion = '1.0.0';

  constructor(
    private graphRepository: IGraphRepository,
    private eventBus: IEventBus
  ) {}

  /**
   * Recalculate Belief for a claim based on graph evidence.
   * Called whenever a claim is created or strengthened.
   */
  async recalculateBelief(
    claim: GraphClaim,
    claimAgeDays: number,
    tenantId: string
  ): Promise<Belief> {
    const timestamp = now();
    const beliefId = createUUID();

    // Calculate confidence from supporting evidence
    const supportingCount = claim.supportingEvidence.length;
    const { confidence, uncertainty } = this.calculateBayesianConfidence(
      claim.supportingEvidence,
      claimAgeDays
    );

    const calculationDetails: BeliefCalculationDetail = {
      algorithm: 'weighted-evidence-accumulation-v1.0',
      inputs: {
        supportingEvidenceCount: supportingCount,
        contradictingEvidenceCount: 0,
        averageSupportConfidence: this.calculateAverageConfidence(claim.supportingEvidence),
        sources: claim.supportingEvidence.map((s) => s.type) as any,
        sampleSize: 1, // Per-learner basis
        timespan: `${claimAgeDays} days`,
      },
      outputs: {
        confidence,
        uncertainty,
        credibilityIntervalLower: Math.max(0, confidence - uncertainty),
        credibilityIntervalUpper: Math.min(1, confidence + uncertainty),
      },
    };

    // Create belief object
    const belief: Belief = {
      beliefId,
      claimId: claim.claimId,
      tenantId,
      confidence,
      uncertainty,
      supportingEvidenceCount: supportingCount,
      contradictingEvidenceCount: 0,
      netEvidenceWeight: supportingCount,
      evidenceSources: new Set(claim.supportingEvidence.map((s) => s.type) as any),
      calculationVersion: this.calculationVersion,
      calculationDetails,
      lastRecalculated: timestamp,
      confidenceHistory: [
        {
          confidence,
          uncertainty,
          timestamp,
          calculationVersion: this.calculationVersion,
          reason: 'initial_calculation',
        },
      ],
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      isStrongBelief: () => confidence > 0.75,
      isWeakBelief: () => confidence < 0.5,
      isHighlyUncertain: () => uncertainty > 0.2,
      confidenceAt: (ts: string) => {
        const entry = belief.confidenceHistory
          .filter((h) => new Date(h.timestamp) <= new Date(ts))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        return entry?.confidence ?? null;
      },
      canReproduceAt: (ts: string, algorithmVersion: string) => {
        return new Date(ts) >= new Date(timestamp) && algorithmVersion === this.calculationVersion;
      },
      withNewEvidence: (
        supportingCount: number,
        contradictingCount: number,
        newCalcVersion: string,
        details?: BeliefCalculationDetail
      ): Belief => {
        // This would typically update the belief
        // For now, return updated structure
        return {
          ...belief,
          supportingEvidenceCount: supportingCount,
          contradictingEvidenceCount: contradictingCount,
          netEvidenceWeight: supportingCount - contradictingCount,
          calculationVersion: newCalcVersion,
          calculationDetails: details,
          updatedAt: now(),
        };
      },
      getCredibilityInterval: () => ({
        lower: Math.max(0, confidence - uncertainty),
        upper: Math.min(1, confidence + uncertainty),
      }),
      getTrend: (): 'increasing' | 'decreasing' | 'stable' => {
        if (belief.confidenceHistory.length < 2) return 'stable';
        const recent = belief.confidenceHistory.slice(-3);
        const newest = recent[recent.length - 1];
        const oldest = recent[0];
        if (!newest || !oldest) return 'stable';
        const trend = newest.confidence - oldest.confidence;
        if (trend > 0.05) return 'increasing';
        if (trend < -0.05) return 'decreasing';
        return 'stable';
      },
    };

    // Persist belief
    await this.graphRepository.saveBelief(belief);

    // Publish event
    await this.eventBus.publish({
      eventId: createUUID(),
      eventType: 'BeliefRecalculated',
      aggregateId: beliefId,
      aggregateType: 'Belief',
      timestamp,
      tenantId,
      version: 1,
      data: {
        beliefId,
        claimId: claim.claimId,
        confidence,
        uncertainty,
        supportingEvidenceCount: supportingCount,
        calculationVersion: this.calculationVersion,
      },
    } as any);

    return belief;
  }

  /**
   * Calculate Bayesian confidence from supporting evidence.
   */
  private calculateBayesianConfidence(
    supportingEvidence: any[],
    claimAgeDays: number
  ): { confidence: number; uncertainty: number } {
    if (supportingEvidence.length === 0) {
      return { confidence: 0, uncertainty: 1.0 };
    }

    // Average confidence across supporting evidence
    const baseConfidence = this.calculateAverageConfidence(supportingEvidence);

    // Uncertainty decreases with evidence accumulation
    const evidenceUncertainty = 1 / Math.sqrt(Math.max(supportingEvidence.length, 1));

    // Age uncertainty: claims decay over 180 days
    const ageUncertainty = Math.min(0.2, claimAgeDays / 900); // 180 days = 0.2

    // Combined uncertainty
    const totalUncertainty = Math.sqrt(evidenceUncertainty ** 2 + ageUncertainty ** 2);

    // Final confidence bounded
    const finalConfidence = Math.max(0, Math.min(1, baseConfidence * (1 - totalUncertainty)));

    return {
      confidence: finalConfidence,
      uncertainty: totalUncertainty,
    };
  }

  /**
   * Calculate average confidence across evidence.
   */
  private calculateAverageConfidence(supportingEvidence: any[]): number {
    if (supportingEvidence.length === 0) return 0;
    const sum = supportingEvidence.reduce((acc, e) => acc + e.confidence, 0);
    return sum / supportingEvidence.length;
  }

  /**
   * Recalculate beliefs for all claims in perspective.
   */
  async recalculateAllBeliefs(tenantId: string, perspectiveId: string): Promise<number> {
    const claims = await this.graphRepository.getClaimsByPerspective(perspectiveId);
    let count = 0;

    for (const claim of claims) {
      if (claim.tenantId === tenantId) {
        const claimAge = Math.floor(
          (new Date().getTime() - new Date(claim.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        await this.recalculateBelief(claim, claimAge, tenantId);
        count++;
      }
    }

    await this.eventBus.publish({
      eventId: createUUID(),
      eventType: 'BeliefsRecalculatedBatch',
      aggregateId: `${tenantId}:${perspectiveId}`,
      aggregateType: 'Belief',
      timestamp: now(),
      tenantId,
      version: 1,
      data: {
        perspectiveId,
        beliefCount: count,
        calculationVersion: this.calculationVersion,
      },
    } as any);

    return count;
  }
}
