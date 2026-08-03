import { withCapability, canAccessResourceOf } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

/**
 * Bring an earlier version back as the current one.
 *
 * This moves the story forward rather than rewriting it: the old content
 * returns as a brand new version, so nothing in the history is lost.
 */
export const POST = withCapability('solution.write', async (request: Request, { params, principal }: any) => {
  try {

    const existing = await prisma.solution.findUnique({ where: { id: params.id } });

    if (!existing || !canAccessResourceOf(principal, existing.userId)) {
      return NextResponse.json({ error: 'Solution not found' }, { status: 404 });
    }

    const versionNumber = Number.parseInt(params.version, 10);

    if (!Number.isFinite(versionNumber)) {
      return NextResponse.json({ error: 'Invalid version' }, { status: 400 });
    }

    const target = await prisma.solutionVersion.findUnique({
      where: { solutionId_version: { solutionId: params.id, version: versionNumber } },
    });

    if (!target) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    if (target.content === existing.content) {
      return NextResponse.json({ solution: existing, restored: false });
    }

    // Derive the next version inside a transaction so a concurrent improve
    // cannot claim the same number.
    const solution = await prisma.$transaction(async (tx) => {
      const latest = await tx.solutionVersion.findFirst({
        where: { solutionId: params.id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const nextVersion = (latest?.version ?? existing.currentVersion) + 1;

      return tx.solution.update({
        where: { id: params.id },
        data: {
          content: target.content,
          currentVersion: nextVersion,
          versions: {
            create: {
              version: nextVersion,
              content: target.content,
              changeNote: `Restored from v${versionNumber}`,
            },
          },
        },
        include: { versions: { orderBy: { version: 'desc' } } },
      });
    });

    return NextResponse.json({ solution, restored: true });
  } catch (error) {
    console.error('Error restoring version:', error);
    return NextResponse.json({ error: 'Failed to restore version' }, { status: 500 });
  }
});
