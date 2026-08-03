import { withCapability, canAccessResourceOf } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

/**
 * Accept a proposal the collaborator offered.
 *
 * The collaborator never writes to a solution. A proposal only becomes a
 * version when the learner says so, and then it goes through exactly the same
 * transactional versioning path as a hand edit.
 */
export const POST = withCapability(
  'solution.write',
  async (request: Request, { params, principal }: any) => {
    try {
      const existing = await prisma.solution.findUnique({ where: { id: params.id } });

      if (!existing || !canAccessResourceOf(principal, existing.userId)) {
        return NextResponse.json({ error: 'Solution not found' }, { status: 404 });
      }

      const { messageId, changeSummary } = await request.json().catch(() => ({}));

      if (!messageId) {
        return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
      }

      const message = await prisma.solutionMessage.findUnique({
        where: { id: messageId },
        include: { conversation: { select: { solutionId: true } } },
      });

      // The proposal must belong to this solution's own thread.
      if (
        !message ||
        message.conversation.solutionId !== params.id ||
        !message.proposedContent
      ) {
        return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
      }

      if (message.acceptedVersion !== null) {
        return NextResponse.json(
          { error: 'That proposal has already been accepted' },
          { status: 409 }
        );
      }

      if (message.proposedContent === existing.content) {
        return NextResponse.json(
          { error: 'That proposal matches the current version' },
          { status: 409 }
        );
      }

      const solution = await prisma.$transaction(async (tx) => {
        const latest = await tx.solutionVersion.findFirst({
          where: { solutionId: params.id },
          orderBy: { version: 'desc' },
          select: { version: true },
        });

        const nextVersion = (latest?.version ?? existing.currentVersion) + 1;

        const updated = await tx.solution.update({
          where: { id: params.id },
          data: {
            content: message.proposedContent!,
            currentVersion: nextVersion,
            versions: {
              create: {
                version: nextVersion,
                content: message.proposedContent!,
                changeNote:
                  typeof changeSummary === 'string' && changeSummary.trim()
                    ? changeSummary.trim()
                    : 'Improved with the collaborator',
              },
            },
          },
          include: { versions: { orderBy: { version: 'desc' } } },
        });

        // Mark the proposal accepted so it cannot be applied twice, and so the
        // thread shows which suggestions actually landed.
        await tx.solutionMessage.update({
          where: { id: messageId },
          data: { acceptedVersion: nextVersion },
        });

        return updated;
      });

      return NextResponse.json({ solution, version: solution.currentVersion });
    } catch (error) {
      console.error('Error accepting proposal:', error);
      return NextResponse.json({ error: 'Failed to accept the proposal' }, { status: 500 });
    }
  }
);
