import { withCapability } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

/**
 * The four numbers that say whether the Collaborator is making us indispensable.
 *
 * Deliberately only four. Everything else is curiosity; these describe whether
 * people come back because they genuinely need their solutions.
 */
export const GET = withCapability('metrics.read', async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(Number(searchParams.get('days')) || 30, 1), 365);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      solutionsOpened,
      solutionsImproved,
      stillInUse,
      olderThan30Days,
      totalSolutions,
      versionCount,
      proposalsOffered,
      proposalsAccepted,
    ] = await Promise.all([
      // 1. Solutions opened — total opens across the window.
      prisma.solution.aggregate({
        _sum: { openCount: true },
        where: { lastOpenedAt: { gte: since } },
      }),

      // 2. Solutions improved — distinct solutions that gained a version.
      prisma.solutionVersion
        .findMany({
          where: { createdAt: { gte: since }, version: { gt: 1 } },
          select: { solutionId: true },
          distinct: ['solutionId'],
        })
        .then((rows) => rows.length),

      // 3. Still in use after 30 days — created over 30 days ago and used since.
      prisma.solution.count({
        where: {
          createdAt: { lt: thirtyDaysAgo },
          lastUsedAt: { gte: thirtyDaysAgo },
          status: 'active',
        },
      }),

      // Denominator for the retention rate: solutions old enough to be judged.
      prisma.solution.count({ where: { createdAt: { lt: thirtyDaysAgo } } }),

      prisma.solution.count(),

      // 4. Average improvements per solution — versions beyond the first.
      prisma.solutionVersion.count({ where: { version: { gt: 1 } } }),

      // Supporting: is the collaborator's advice actually being taken?
      prisma.solutionMessage.count({ where: { proposedContent: { not: null } } }),
      prisma.solutionMessage.count({ where: { acceptedVersion: { not: null } } }),
    ]);

    return NextResponse.json({
      windowDays: days,
      // The four numbers.
      solutionsOpened: solutionsOpened._sum.openCount ?? 0,
      solutionsImproved,
      stillInUseAfter30Days: stillInUse,
      averageImprovementsPerSolution:
        totalSolutions > 0 ? Number((versionCount / totalSolutions).toFixed(2)) : 0,

      // Context for reading them honestly.
      context: {
        totalSolutions,
        solutionsOldEnoughToJudge: olderThan30Days,
        retentionRate:
          olderThan30Days > 0 ? Number(((stillInUse / olderThan30Days) * 100).toFixed(1)) : null,
        proposalsOffered,
        proposalsAccepted,
        proposalAcceptanceRate:
          proposalsOffered > 0
            ? Number(((proposalsAccepted / proposalsOffered) * 100).toFixed(1))
            : null,
      },
    });
  } catch (error) {
    console.error('Error loading collaborator metrics:', error);
    return NextResponse.json({ error: 'Failed to load metrics' }, { status: 500 });
  }
});
