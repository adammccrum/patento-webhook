/**
 * Route-level enforcement.
 *
 * Every protected endpoint is wrapped in `withCapability`, which resolves the
 * principal, checks the declared capability, and only then runs the handler.
 * A handler therefore never sees an unauthorised caller and never needs to
 * check a role itself.
 */

import { AuthorizationError, type Principal } from './policy';
import type { Capability } from './capabilities';

/** Resolves the current request's principal. Supplied once, by the app. */
export type PrincipalResolver = () => Promise<Principal | null>;

export interface AuthorizedContext<P = unknown> {
  principal: Principal;
  params: P;
}

export type AuthorizedHandler<P = unknown> = (
  request: Request,
  context: AuthorizedContext<P>
) => Promise<Response> | Response;

let resolvePrincipal: PrincipalResolver | null = null;

/**
 * Install the resolver. Called once at startup by the consuming app, which is
 * the only layer that knows how sessions work.
 */
export function configureAuthorization(resolver: PrincipalResolver): void {
  resolvePrincipal = resolver;
}

function denial(error: AuthorizationError): Response {
  // The body says nothing about which capability was missing: telling an
  // attacker the name of the permission they lack is free reconnaissance.
  return new Response(
    JSON.stringify({ error: error.reason === 'unauthenticated' ? 'Unauthorized' : 'Forbidden' }),
    { status: error.status, headers: { 'content-type': 'application/json' } }
  );
}

/**
 * Wrap a route handler so it runs only for a principal holding `capability`.
 *
 * ```ts
 * export const GET = withCapability('metrics.read', async (req, { principal }) => { ... });
 * ```
 */
export function withCapability<P = unknown>(
  capability: Capability,
  handler: AuthorizedHandler<P>
) {
  return async (request: Request, routeContext?: { params: P }): Promise<Response> => {
    try {
      if (!resolvePrincipal) {
        throw new Error(
          'Authorization is not configured. Call configureAuthorization() at startup.'
        );
      }

      const principal = await resolvePrincipal();

      if (!principal) {
        throw new AuthorizationError('unauthenticated');
      }
      if (!principal.capabilities.has(capability)) {
        throw new AuthorizationError('forbidden', capability);
      }

      return await handler(request, {
        principal,
        params: (routeContext?.params ?? {}) as P,
      });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return denial(error);
      }
      throw error;
    }
  };
}

/**
 * For the few endpoints that are deliberately public (health checks, shared
 * solution pages). Exists so that "no wrapper" always means "someone forgot",
 * and a reviewer can grep for intent.
 */
export function publicRoute<P = unknown>(
  handler: (request: Request, context: { params: P }) => Promise<Response> | Response
) {
  return async (request: Request, routeContext?: { params: P }): Promise<Response> =>
    handler(request, { params: (routeContext?.params ?? {}) as P });
}
