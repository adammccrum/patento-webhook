import { withCapability } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

export const POST = withCapability('mission.complete', async (request: Request, { principal }: any) => {
  try {

    const { missionId, courseId, reflection, problem, content } = await request.json();

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
          userId: principal.userId,
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

    // Add new toolkit item with impact statement
    const minutes = mission.timeSavedMinutes || 0;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    let impact = mission.achievement || 'Built successfully';
    if (minutes > 0) {
      impact = `Saves approximately ${hours > 0 ? `${hours} hour${hours !== 1 ? 's' : ''}` : ''} ${mins > 0 ? `${mins} minute${mins !== 1 ? 's' : ''}` : ''}`.trim() + ' every week.';
    }

    const newToolkitItem = {
      missionId,
      title: mission.title,
      toolkitName: mission.toolkitName,
      impact,
      problemArea: mission.problemArea,
      reflection,
      completedAt: new Date().toISOString(),
    };

    toolkitItems.push(newToolkitItem);

    // The mission produced a real tool. Give it a home in the toolbox so the
    // learner can keep using and improving it long after the course ends.
    const solutionContent =
      (typeof content === 'string' && content.trim()) ||
      mission.buildTemplate ||
      `A solution for: ${mission.title}`;

    const solution = await prisma.solution.create({
      data: {
        userId: principal.userId,
        name: mission.toolkitName,
        problem:
          typeof problem === 'string' && problem.trim() ? problem.trim() : mission.description,
        problemArea: mission.problemArea,
        content: solutionContent,
        notes: reflection,
        timeSavedMinutes: mission.timeSavedMinutes || 0,
        originMissionId: missionId,
        originCourseId: courseId,
        versions: {
          create: {
            version: 1,
            content: solutionContent,
            changeNote: `Built during "${mission.title}"`,
          },
        },
      },
    });

    // Update enrollment
    const updatedEnrollment = await prisma.courseEnrollment.update({
      where: {
        userId_courseId: {
          userId: principal.userId,
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
    console.log(`Mission ${missionId} completed by user ${principal.userId}. Reflection: ${reflection}`);

    return NextResponse.json(
      {
        message: 'Mission completed successfully',
        enrollment: updatedEnrollment,
        solution: { id: solution.id, name: solution.name },
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
});
