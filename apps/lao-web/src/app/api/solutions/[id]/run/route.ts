import { withCapability, canAccessResourceOf } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

/**
 * Record that the learner actually used this solution.
 *
 * Usage is the signal that matters — it drives what the workspace notices,
 * and it is the difference between a finished assignment and a tool someone
 * relies on.
 */
export const POST = withCapability('solution.write', async (request: Request, { params, principal }: any) => {
  try {

    const existing = await prisma.solution.findUnique({ where: { id: params.id } });

    if (!existing || !canAccessResourceOf(principal, existing.userId)) {
      return NextResponse.json({ error: 'Solution not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { timeSavedMinutes, note } = body ?? {};

    // Fall back to the solution's own per-use estimate when none is given.
    const saved = Number.isFinite(timeSavedMinutes)
      ? Math.max(0, timeSavedMinutes)
      : existing.timeSavedMinutes;

    const [, solution] = await prisma.$transaction([
      prisma.solutionRun.create({
        data: {
          solutionId: params.id,
          version: existing.currentVersion,
          timeSavedMinutes: saved,
          note: typeof note === 'string' && note.trim() ? note.trim() : null,
        },
      }),
      prisma.solution.update({
        where: { id: params.id },
        data: {
          useCount: { increment: 1 },
          lastUsedAt: new Date(),
          totalTimeSavedMinutes: { increment: saved },
        },
      }),
    ]);

    return NextResponse.json({ solution });
  } catch (error) {
    console.error('Error recording solution run:', error);
    return NextResponse.json({ error: 'Failed to record use' }, { status: 500 });
  }
});
