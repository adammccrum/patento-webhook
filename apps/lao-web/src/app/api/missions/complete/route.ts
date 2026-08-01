import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { missionId, courseId, reflection } = await request.json();

    if (!missionId || !courseId || !reflection) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get mission details
    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
    });

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Get or create enrollment
    let enrollment = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId,
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: 'Course enrollment not found' },
        { status: 404 }
      );
    }

    // Parse existing toolkitItems
    const toolkitItems = Array.isArray(enrollment.toolkitItems)
      ? enrollment.toolkitItems
      : typeof enrollment.toolkitItems === 'string'
        ? JSON.parse(enrollment.toolkitItems)
        : [];

    // Add new toolkit item
    const newToolkitItem = {
      missionId,
      title: mission.title,
      toolkitName: mission.toolkitName,
      completedAt: new Date().toISOString(),
    };

    toolkitItems.push(newToolkitItem);

    // Update enrollment
    const updatedEnrollment = await prisma.courseEnrollment.update({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId,
        },
      },
      data: {
        toolkitItems,
        missionsCompleted: {
          increment: 1,
        },
        currentMissionPosition: {
          increment: 1,
        },
        lastAccessedAt: new Date(),
      },
    });

    // Log the reflection (could also save to SessionMetrics or a dedicated reflection table)
    console.log(`Mission ${missionId} completed by user ${session.user.id}. Reflection: ${reflection}`);

    return NextResponse.json(
      {
        message: 'Mission completed successfully',
        enrollment: updatedEnrollment,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error completing mission:', error);
    return NextResponse.json(
      { error: 'Failed to complete mission' },
      { status: 500 }
    );
  }
}
