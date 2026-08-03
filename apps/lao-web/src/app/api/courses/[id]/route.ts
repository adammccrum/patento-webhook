import { withCapability } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

export const GET = withCapability('course.read', async (request: Request, { params, principal }: any) => {
  try {

    // Resolve by slug, cuid, or ordinal position. Links use the slug, but
    // "/course/1" was shipped in earlier builds and must not dead-end.
    const key = params.id as string;
    const position = /^\d+$/.test(key) ? Number(key) : null;

    const course = await prisma.course.findFirst({
      where: {
        OR: [
          { slug: key },
          { id: key },
          ...(position !== null ? [{ position }] : []),
        ],
      },
      include: {
        missions: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Everything below keys off the real id, whatever the caller used.
    const courseId = course.id;

    // Get or create enrollment
    let enrollment = await prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId: principal.userId,
          courseId,
        },
      },
    });

    if (!enrollment) {
      enrollment = await prisma.courseEnrollment.create({
        data: {
          userId: principal.userId,
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
      where: { userId: principal.userId, originCourseId: courseId, status: 'active' },
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
});
