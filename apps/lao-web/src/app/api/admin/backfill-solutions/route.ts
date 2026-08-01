import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

interface LegacyToolkitItem {
  missionId?: string;
  title?: string;
  toolkitName?: string;
  impact?: string;
  problemArea?: string;
  reflection?: string;
  completedAt?: string;
}

/**
 * Move solutions built before the toolbox existed out of the enrollment JSON
 * blob and into real Solution rows, so they gain versions and usage history.
 *
 * Safe to run more than once: a mission that already has a Solution is skipped.
 */
export async function POST() {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    const enrollments = await prisma.courseEnrollment.findMany({ where: { userId } });

    const existing = await prisma.solution.findMany({
      where: { userId, originMissionId: { not: null } },
      select: { originMissionId: true },
    });
    const alreadyMigrated = new Set(existing.map((s) => s.originMissionId));

    let created = 0;
    let skipped = 0;

    for (const enrollment of enrollments) {
      const raw = enrollment.toolkitItems;
      const items: LegacyToolkitItem[] = Array.isArray(raw)
        ? (raw as LegacyToolkitItem[])
        : typeof raw === 'string'
          ? JSON.parse(raw)
          : [];

      for (const item of items) {
        if (!item?.missionId || alreadyMigrated.has(item.missionId)) {
          skipped++;
          continue;
        }

        const mission = await prisma.mission.findUnique({ where: { id: item.missionId } });

        // Legacy items carried no content, so seed from whatever the mission
        // provided and let the learner improve it from there.
        const content =
          mission?.buildTemplate ||
          `A solution for: ${item.toolkitName || item.title || 'this problem'}`;

        await prisma.solution.create({
          data: {
            userId,
            name: item.toolkitName || item.title || 'Solution',
            problem: mission?.description || item.title || 'A problem worth solving',
            problemArea: item.problemArea || mission?.problemArea || 'General',
            content,
            notes: item.reflection || null,
            timeSavedMinutes: mission?.timeSavedMinutes || 0,
            originMissionId: item.missionId,
            originCourseId: enrollment.courseId,
            createdAt: item.completedAt ? new Date(item.completedAt) : undefined,
            versions: {
              create: {
                version: 1,
                content,
                changeNote: 'Moved into your toolbox',
              },
            },
          },
        });

        alreadyMigrated.add(item.missionId);
        created++;
      }
    }

    return NextResponse.json({ created, skipped });
  } catch (error) {
    console.error('Error backfilling solutions:', error);
    return NextResponse.json({ error: 'Failed to backfill solutions' }, { status: 500 });
  }
}
