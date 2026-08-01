import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const courseId = params.id;

    // Get course with missions
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        missions: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
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
      enrollment = await prisma.courseEnrollment.create({
        data: {
          userId: session.user.id,
          courseId,
        },
      });
    }

    // Update last accessed
    await prisma.courseEnrollment.update({
      where: { id: enrollment.id },
      data: { lastAccessedAt: new Date() },
    });

    // The living tools this course produced, so the learner can open them
    // straight from here rather than hunting through the toolbox.
    const solutions = await prisma.solution.findMany({
      where: { userId: session.user.id, originCourseId: courseId, status: 'active' },
      select: {
        id: true,
        name: true,
        problem: true,
        problemArea: true,
        currentVersion: true,
        useCount: true,
        lastUsedAt: true,
        originMissionId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      course,
      enrollment: {
        currentMissionPosition: enrollment.currentMissionPosition,
        missionsCompleted: enrollment.missionsCompleted,
        toolkitItems: enrollment.toolkitItems,
      },
      solutions,
    });
  } catch (error) {
    console.error('Error fetching course:', error);
    return NextResponse.json(
      { error: 'Failed to fetch course' },
      { status: 500 }
    );
  }
}
