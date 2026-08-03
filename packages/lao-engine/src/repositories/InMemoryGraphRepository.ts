/**
 * InMemoryGraphRepository
 *
 * In-memory implementation of graph persistence.
 * Suitable for testing and development.
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
import { IGraphRepository } from './GraphRepository';

export class InMemoryGraphRepository implements IGraphRepository {
  private nodes = new Map<string, SemanticNode>();
  private claims = new Map<string, GraphClaim>();
  private beliefs = new Map<string, Belief>();
  private perspectives = new Map<string, Perspective>();
  private graphVersions = new Map<string, GraphVersion>();
  private contexts = new Map<string, Context>();
  private knowledgeVersions = new Map<string, KnowledgeVersion>();

  // Semantic Nodes
  async saveNode(node: SemanticNode): Promise<void> {
    this.nodes.set(node.nodeId, node);
  }

  async getNodeById(nodeId: string): Promise<SemanticNode | null> {
    return this.nodes.get(nodeId) || null;
  }

  async getNodesByType(type: string, tenantId: string): Promise<SemanticNode[]> {
    return Array.from(this.nodes.values()).filter(n => n.type === type && n.tenantId === tenantId);
  }

  async getNodeHistory(nodeId: string): Promise<SemanticNode[]> {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    // In a real implementation, this would query versioned history
    return [node];
  }

  async getSupersessionChain(nodeId: string): Promise<string[]> {
    const chain: string[] = [];
    let current = nodeId;
    while (current) {
      chain.push(current);
      const node = this.nodes.get(current);
      if (!node || !node.superseded_by) break;
      current = node.superseded_by;
    }
    return chain;
  }

  // Graph Claims
  async saveClaim(claim: GraphClaim): Promise<void> {
    this.claims.set(claim.claimId, claim);
  }

  async getClaimById(claimId: string): Promise<GraphClaim | null> {
    return this.claims.get(claimId) || null;
  }

  async getClaimsInvolvingNode(nodeId: string): Promise<GraphClaim[]> {
    return Array.from(this.claims.values()).filter(
      c => c.fromNodeId === nodeId || c.toNodeId === nodeId
    );
  }

  async getClaimsBetween(fromNodeId: string, toNodeId: string): Promise<GraphClaim[]> {
    return Array.from(this.claims.values()).filter(
      c => c.fromNodeId === fromNodeId && c.toNodeId === toNodeId
    );
  }

  async getClaimsByPerspective(perspectiveId: string): Promise<GraphClaim[]> {
    return Array.from(this.claims.values()).filter(c => c.perspectiveId === perspectiveId);
  }

  async getClaimsWithStatus(status: string, tenantId: string): Promise<GraphClaim[]> {
    return Array.from(this.claims.values()).filter(
      c => c.status === status && c.tenantId === tenantId
    );
  }

  async getClaimHistory(claimId: string): Promise<GraphClaim[]> {
    const claim = this.claims.get(claimId);
    if (!claim) return [];
    return [claim];
  }

  // Beliefs
  async saveBelief(belief: Belief): Promise<void> {
    this.beliefs.set(belief.beliefId, belief);
  }

  async getBeliefInClaim(claimId: string): Promise<Belief | null> {
    return Array.from(this.beliefs.values()).find(b => b.claimId === claimId) || null;
  }

  async getBeliefHistory(claimId: string): Promise<Belief[]> {
    return Array.from(this.beliefs.values()).filter(b => b.claimId === claimId);
  }

  async getBeliefsByVersion(calculationVersion: string): Promise<Belief[]> {
    return Array.from(this.beliefs.values()).filter(b => b.calculationVersion === calculationVersion);
  }

  // Perspectives
  async savePerspective(perspective: Perspective): Promise<void> {
    this.perspectives.set(perspective.perspectiveId, perspective);
  }

  async getPerspectiveById(perspectiveId: string): Promise<Perspective | null> {
    return this.perspectives.get(perspectiveId) || null;
  }

  async getPerspectivesByTenant(tenantId: string): Promise<Perspective[]> {
    return Array.from(this.perspectives.values()).filter(p => p.tenantId === tenantId);
  }

  // Graph Versions
  async saveGraphVersion(version: GraphVersion): Promise<void> {
    this.graphVersions.set(version.graphVersionId, version);
  }

  async getGraphVersionById(versionId: string): Promise<GraphVersion | null> {
    return this.graphVersions.get(versionId) || null;
  }

  async getCurrentGraphVersion(tenantId: string): Promise<GraphVersion | null> {
    const versions = Array.from(this.graphVersions.values()).filter(
      v => v.tenantId === tenantId && !v.deprecatedAt
    );
    return versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
  }

  async getGraphVersionHistory(tenantId: string): Promise<GraphVersion[]> {
    return Array.from(this.graphVersions.values())
      .filter(v => v.tenantId === tenantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Contexts
  async saveContext(context: Context): Promise<void> {
    this.contexts.set(context.contextId, context);
  }

  async getContextById(contextId: string): Promise<Context | null> {
    return this.contexts.get(contextId) || null;
  }

  async getContextsByType(type: string, tenantId: string): Promise<Context[]> {
    return Array.from(this.contexts.values()).filter(c => c.type === type && c.tenantId === tenantId);
  }

  async getContextHierarchy(parentId: string): Promise<Context[]> {
    return Array.from(this.contexts.values()).filter(c => c.parentContextId === parentId);
  }

  // Knowledge Versions
  async saveKnowledgeVersion(version: KnowledgeVersion): Promise<void> {
    this.knowledgeVersions.set(`${version.nodeId}:${version.versionNumber}`, version);
  }

  async getKnowledgeVersion(nodeId: string, versionNumber: string): Promise<KnowledgeVersion | null> {
    return this.knowledgeVersions.get(`${nodeId}:${versionNumber}`) || null;
  }

  async getVersionHistory(nodeId: string): Promise<KnowledgeVersion[]> {
    return Array.from(this.knowledgeVersions.values()).filter(v => v.nodeId === nodeId);
  }

  // Queries
  async queryNodesByName(name: string, tenantId: string): Promise<SemanticNode[]> {
    return Array.from(this.nodes.values()).filter(
      n => n.name.toLowerCase().includes(name.toLowerCase()) && n.tenantId === tenantId
    );
  }

  async queryClaimsByType(type: string, tenantId: string): Promise<GraphClaim[]> {
    return Array.from(this.claims.values()).filter(c => c.type === type && c.tenantId === tenantId);
  }

  async findPathBetweenNodes(fromNodeId: string, toNodeId: string, tenantId: string): Promise<string[]> {
    // Simple BFS to find path
    const visited = new Set<string>();
    const queue: string[][] = [[fromNodeId]];

    while (queue.length > 0) {
      const path = queue.shift();
      if (!path || path.length === 0) break;

      const current = path[path.length - 1]!;
      if (current === toNodeId) return path;

      if (visited.has(current)) continue;
      visited.add(current);

      const claims = await this.getClaimsInvolvingNode(current);
      for (const claim of claims) {
        if (claim.tenantId !== tenantId) continue;
        const next = claim.fromNodeId === current ? claim.toNodeId : claim.fromNodeId;
        if (!visited.has(next)) {
          queue.push([...path, next]);
        }
      }
    }

    return [];
  }

  async findRelatedNodes(nodeId: string, relationshipTypes: string[]): Promise<SemanticNode[]> {
    const claims = await this.getClaimsInvolvingNode(nodeId);
    const relatedIds = new Set<string>();

    for (const claim of claims) {
      if (!relationshipTypes.includes(claim.type)) continue;
      if (claim.fromNodeId === nodeId) {
        relatedIds.add(claim.toNodeId);
      } else {
        relatedIds.add(claim.fromNodeId);
      }
    }

    const related: SemanticNode[] = [];
    for (const id of relatedIds) {
      const node = await this.getNodeById(id);
      if (node) related.push(node);
    }

    return related;
  }

  // Temporal queries
  async getNodesValidAt(timestamp: string, tenantId: string): Promise<SemanticNode[]> {
    return Array.from(this.nodes.values()).filter(
      n => n.tenantId === tenantId && n.isValidAt(timestamp)
    );
  }

  async getClaimsValidAt(timestamp: string, tenantId: string): Promise<GraphClaim[]> {
    return Array.from(this.claims.values()).filter(
      c => c.tenantId === tenantId && c.isValidAt(timestamp)
    );
  }

  async getGraphStateAt(timestamp: string, tenantId: string): Promise<GraphVersion | null> {
    const versions = await this.getGraphVersionHistory(tenantId);
    for (const version of versions) {
      if (new Date(version.createdAt) <= new Date(timestamp)) {
        return version;
      }
    }
    return null;
  }

  // Transactions (no-op in memory)
  async beginTransaction(): Promise<void> {
    // No-op for in-memory
  }

  async commit(): Promise<void> {
    // No-op for in-memory
  }

  async rollback(): Promise<void> {
    // No-op for in-memory
  }

  // Test utilities
  clear(): void {
    this.nodes.clear();
    this.claims.clear();
    this.beliefs.clear();
    this.perspectives.clear();
    this.graphVersions.clear();
    this.contexts.clear();
    this.knowledgeVersions.clear();
  }
}
