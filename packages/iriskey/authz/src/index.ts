/**
 * IrisKey Platform - Central authorization.
 *
 * One policy engine. Every endpoint declares the capability it requires; no
 * route, service or component checks a role directly.
 */

export {
  CAPABILITIES,
  ROLES,
  ROLE_CAPABILITIES,
  DEFAULT_ROLE,
  capabilitiesFor,
  toRole,
  type Capability,
  type Role,
} from './capabilities';

export {
  AuthorizationError,
  authorize,
  authorizeResourceOf,
  can,
  canAccessResourceOf,
  createPrincipal,
  type DenialReason,
  type Principal,
} from './policy';

export {
  configureAuthorization,
  publicRoute,
  withCapability,
  type AuthorizedContext,
  type AuthorizedHandler,
  type PrincipalResolver,
} from './route';
