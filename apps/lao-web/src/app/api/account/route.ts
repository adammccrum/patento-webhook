import { withCapability } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { getAuditService } from '@iriskey/audit';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

/**
 * Delete the account and everything in it (GDPR Art. 17).
 *
 * Irreversible, and it takes the solutions with it, so it requires the learner
 * to type their own email address. Cascades from User remove solutions,
 * versions, runs, conversations, messages, enrolments, sessions and credits —
 * verified by test.
 */
export const DELETE = withCapability(
  'account.write',
  async (request: Request, { principal }: any) => {
    try {
      const userId = principal.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      const body = await request.json().catch(() => ({}));

      // Typing the address is the confirmation. A stray DELETE cannot destroy
      // someone's work by accident.
      if (
        typeof body?.confirmEmail !== 'string' ||
        body.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()
      ) {
        return NextResponse.json(
          { error: 'Type your email address exactly to confirm deletion' },
          { status: 400 }
        );
      }

      // Record it before the actor disappears. The log keeps no personal data
      // beyond what is needed to show the deletion was requested and honoured.
      try {
        await getAuditService().log({
          userId,
          productId: process.env.PRODUCT_ID ?? 'lao',
          action: 'account_deleted',
          resource: 'account',
          details: { requestedAt: new Date().toISOString() },
        });
      } catch {
        // Never block a deletion because the audit write failed.
      }

      const counts = {
        solutions: await prisma.solution.count({ where: { userId } }),
      };

      // One statement; every dependent row goes with it via onDelete: Cascade.
      await prisma.user.delete({ where: { id: userId } });

      return NextResponse.json({
        deleted: true,
        message: 'Your account and everything in it has been deleted.',
        removed: counts,
      });
    } catch (error) {
      console.error('Error deleting account:', error);
      return NextResponse.json({ error: 'Failed to delete your account' }, { status: 500 });
    }
  }
);
