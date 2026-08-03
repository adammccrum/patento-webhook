/**
 * GraphVersion
 *
 * Version the entire knowledge graph.
 * Enables reproducibility, A/B testing, and regression analysis.
 *
 * Each recommendation records:
 * - Graph version
 * - Belief model version
 * - Algorithm version
 *
 * This allows exact replay of historical reasoning.
 */

export interface GraphVersionMetadata {
  nodesCount: number;
  claimsCount: number;
  beliefsCount: number;
  perspectivesIncluded: string[]; // perspectiveIds
  contextHierarchyDepth: number;
  averageClaimStrength: number; // 0-1
}

export interface GraphVersion {
  graphVersionId: string;
  tenantId: string;

  // Version identifier
  versionNumber: string; // "1.0.0", "1.2.3"
  releaseNotes?: string;

  // Component versions used in this graph
  beliefModelVersion: string; // "belief-algorithm-v2.1.4"
  semanticLayerVersion: string; // "semantic-v1.0"

  // Immutable snapshot metadata
  metadata: GraphVersionMetadata;

  // Lifecycle
  createdAt: string;
  publicAt?: string; // when made available to learners
  deprecatedAt?: string;
  replacedBy?: string; // graphVersionId of successor

  // Stability markers
  isStable: boolean; // ready for production?
  isLocked: boolean; // changes prevented?

  // Lineage
  previousVersionId?: string;
  changes?: string[]; // what changed from previous?

  // Methods
  isCompatibleWith(otherVersion: GraphVersion): boolean;
  canUpgradeTo(targetVersion: GraphVersion): boolean;
}
