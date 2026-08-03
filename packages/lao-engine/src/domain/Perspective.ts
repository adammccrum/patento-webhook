/**
 * Perspective
 *
 * Represents a distinct viewpoint on educational truth.
 * Multiple perspectives can coexist without contradiction.
 * Each maintains its own claims and beliefs.
 *
 * Examples:
 * - UK National Curriculum
 * - AWS Certification Path
 * - Microsoft Learning
 * - Open Source Community
 * - Internal LAO Research
 *
 * The recommendation engine decides which perspective(s) matter for each learner.
 */

export type AuthorityType = 'educational_standard' | 'industry' | 'organization' | 'research' | 'community';

export interface Perspective {
  perspectiveId: string;
  tenantId: string;

  // Identity
  name: string; // "UK National Curriculum", "AWS"
  description?: string;

  // Authority
  authorityType: AuthorityType;
  maintainedBy: string; // organization or individual
  trustLevel?: number; // 0-1: default weight for this perspective's claims

  // Perspective's content
  claimIds: string[]; // claims made from this perspective
  beliefIds: string[]; // beliefs maintained by this perspective

  // Versioning
  version: number;

  // Lifecycle
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deprecatedAt?: string;
  replacedBy?: string; // perspectiveId of successor

  // Methods
  addClaim(claimId: string): Perspective;
  addBelief(beliefId: string): Perspective;
  removeClaim(claimId: string): Perspective;
  isAuthorityIn(field: string): boolean;
}
