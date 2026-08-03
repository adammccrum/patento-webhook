// PUBLIC ROUTE — deliberately requires no capability. Somebody completing a
// password reset cannot be signed in; requiring a capability here would mean
// requiring the very access they have lost. The token is the authorisation.
/**
 * Complete a password reset.
 *
 * The other half of `forgot-password`, which has been minting tokens and
 * emailing links to `/auth/reset-password` since it was written — a page that
 * did not exist, served by an endpoint that did not exist. Anyone who forgot
 * their password was locked out permanently, and the flow reported success at
 * every step on the way.
 *
 * Not a dead control on any page: the form worked and returned 200. The dead
 * part was on the other side of an email, which is where the page-level audit
 * could not see it.
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { hashPassword } from '@iriskey/auth';
import {
  withErrorHandler,
  ApiResponseBuilder,
  ApiErrorResponse,
  validationError,
  toResponse,
} from '@iriskey/middleware';
import { getAuditService } from '@iriskey/audit';
import { getRateLimitStore, RateLimitPresets } from '@iriskey/ratelimit';
import { getLogger } from '@iriskey/monitoring';
import { db } from '@/lib/db';
import { checkPassword, passwordField } from '@/lib/password';

const schema = z.object({
  token: z.string().min(1, 'This reset link is missing its token'),
  password: passwordField,
});

/** POST /api/auth/reset-password */
export const POST = withErrorHandler(async (request: NextRequest, ctx) => {
  const logger = getLogger();

  // Same preset as requesting a reset: this endpoint is equally worth
  // guessing at, since a token is the only thing standing in front of an
  // account.
  const rateLimit = await getRateLimitStore().checkLimit(
    'passwordReset',
    ctx.ipAddress ?? 'unknown',
    RateLimitPresets.passwordReset
  );

  if (rateLimit.limited) {
    logger.warn('Password reset completion rate limit exceeded', {
      context: { ipAddress: ctx.ipAddress, productId: ctx.productId },
    });
    throw new ApiErrorResponse('RATE_LIMITED', 'Too many attempts. Try again shortly.', 429);
  }

  const validation = schema.safeParse(await request.json());
  if (!validation.success) {
    return validationError(validation.error.errors[0].message);
  }

  const { token, password } = validation.data;

  const record = await db.verificationToken.findUnique({ where: { token } });

  // One message for missing, wrong-type and expired-then-deleted, so the
  // endpoint cannot be used to learn which tokens ever existed.
  if (!record) {
    throw new ApiErrorResponse('INVALID_TOKEN', 'This reset link is invalid or has already been used', 400);
  }

  // A verification token lasts 24 hours and is emailed on registration; a
  // reset token lasts one hour. Accepting either here would let the longer,
  // more freely issued token change a password.
  if (record.type !== 'password-reset') {
    throw new ApiErrorResponse('INVALID_TOKEN', 'This reset link is invalid or has already been used', 400);
  }

  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { token } });
    throw new ApiErrorResponse('TOKEN_EXPIRED', 'This reset link has expired. Request a new one.', 400);
  }

  const user = await db.user.findUnique({ where: { email: record.identifier } });
  if (!user) {
    // The account went away between requesting and completing. Burn the token.
    await db.verificationToken.delete({ where: { token } });
    throw new ApiErrorResponse('INVALID_TOKEN', 'This reset link is invalid or has already been used', 400);
  }

  const problem = checkPassword(password, user.email);
  if (problem) {
    // Deliberately not consumed: a rejected password is the person getting it
    // wrong, not the link being spent. Otherwise one weak attempt would send
    // them back to the start of the flow.
    return validationError(problem);
  }

  await db.user.update({
    where: { id: user.id },
    data: { password: await hashPassword(password) },
  });

  // Every outstanding reset for this address, not only the one used. Two
  // requests in an hour would otherwise leave a second working link behind.
  await db.verificationToken.deleteMany({
    where: { identifier: user.email, type: 'password-reset' },
  });

  await getAuditService().logPasswordReset(user.id, ctx.productId);

  logger.info('Password reset completed', {
    context: { userId: user.id, productId: ctx.productId },
  });

  return toResponse(
    ApiResponseBuilder.success({ message: 'Your password has been changed. You can sign in now.' }),
    200
  );
});
