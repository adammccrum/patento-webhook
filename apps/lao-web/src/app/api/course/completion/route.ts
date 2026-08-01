import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { courseId, successAnswer } = await request.json();

    if (!courseId || !successAnswer) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get enrollment
    const enrollment = await prisma.courseEnrollment.findUnique({
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

    // Update enrollment with completion and success answer
    const updatedEnrollment = await prisma.courseEnrollment.update({
      where: {
        userId_courseId: {
          userId: session.user.id,
          courseId,
        },
      },
      data: {
        completedAt: new Date(),
        lastAccessedAt: new Date(),
        // Store success answer in metadata or log it
      },
    });

    // Log the success answer
    console.log(`Course ${courseId} completed by user ${session.user.id}. Success answer: ${successAnswer}`);

    return NextResponse.json(
      {
        message: 'Course completed successfully',
        enrollment: updatedEnrollment,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error completing course:', error);
    return NextResponse.json(
      { error: 'Failed to complete course' },
      { status: 500 }
    );
  }
}
