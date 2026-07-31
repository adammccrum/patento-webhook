/**
 * GraphRepository
 *
 * Data access layer for knowledge graph persistence.
 * Abstracts storage details, enabling multiple implementations.
 */

import {
  SemanticNode,
  GraphClaim,
  Belief,
  Perspective,
  GraphVersion,
  Context,
  KnowledgeVersion,
} from '../domain';

export interface IGraphRepository {
  // Semantic Nodes
  saveNode(node: SemanticNode): Promise<void>;
  getNodeById(nodeId: string): Promise<SemanticNode | null>;
  getNodesByType(type: string, tenantId: string): Promise<SemanticNode[]>;
  getNodeHistory(nodeId: string): Promise<SemanticNode[]>;
  getSupersessionChain(nodeId: string): Promise<string[]>;

  // Graph Claims
  saveClaim(claim: GraphClaim): Promise<void>;
  getClaimById(claimId: string): Promise<GraphClaim | null>;
  getClaimsInvolvingNode(nodeId: string): Promise<GraphClaim[]>;
  getClaimsBetween(fromNodeId: string, toNodeId: string): Promise<GraphClaim[]>;
  getClaimsByPerspective(perspectiveId: string): Promise<GraphClaim[]>;
  getClaimsWithStatus(status: string, tenantId: string): Promise<GraphClaim[]>;
  getClaimHistory(claimId: string): Promise<GraphClaim[]>;

  // Beliefs
  saveBelief(belief: Belief): Promise<void>;
  getBeliefInClaim(claimId: string): Promise<Belief | null>;
  getBeliefHistory(claimId: string): Promise<Belief[]>;
  getBeliefsByVersion(calculationVersion: string): Promise<Belief[]>;

  // Perspectives
  savePerspective(perspective: Perspective): Promise<void>;
  getPerspectiveById(perspectiveId: string): Promise<Perspective | null>;
  getPerspectivesByTenant(tenantId: string): Promise<Perspective[]>;

  // Graph Versions
  saveGraphVersion(version: GraphVersion): Promise<void>;
  getGraphVersionById(versionId: string): Promise<GraphVersion | null>;
  getCurrentGraphVersion(tenantId: string): Promise<GraphVersion | null>;
  getGraphVersionHistory(tenantId: string): Promise<GraphVersion[]>;

  // Contexts
  saveContext(context: Context): Promise<void>;
  getContextById(contextId: string): Promise<Context | null>;
  getContextsByType(type: string, tenantId: string): Promise<Context[]>;
  getContextHierarchy(parentId: string): Promise<Context[]>;

  // Knowledge Versions
  saveKnowledgeVersion(version: KnowledgeVersion): Promise<void>;
  getKnowledgeVersion(nodeId: string, versionNumber: string): Promise<KnowledgeVersion | null>;
  getVersionHistory(nodeId: string): Promise<KnowledgeVersion[]>;

  // Queries
  queryNodesByName(name: string, tenantId: string): Promise<SemanticNode[]>;
  queryClaimsByType(type: string, tenantId: string): Promise<GraphClaim[]>;
  findPathBetweenNodes(fromNodeId: string, toNodeId: string, tenantId: string): Promise<string[]>;
  findRelatedNodes(nodeId: string, relationshipTypes: string[]): Promise<SemanticNode[]>;

  // Temporal queries
  getNodesValidAt(timestamp: string, tenantId: string): Promise<SemanticNode[]>;
  getClaimsValidAt(timestamp: string, tenantId: string): Promise<GraphClaim[]>;
  getGraphStateAt(timestamp: string, tenantId: string): Promise<GraphVersion | null>;

  // Transaction support
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
