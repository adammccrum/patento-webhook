import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { goalId, reflection } = body;

    if (!goalId || !reflection) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get goal and mission
    const goal = await prisma.learnerGoal.findUnique({
      where: { id: goalId },
    });

    if (!goal || goal.userId !== session.user.id) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Get the mission
    const mission = await prisma.mission.findFirst({
      where: { goalId, userId: session.user.id, status: 'completed' },
      orderBy: { createdAt: 'desc' },
    });

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Create portfolio entry (public record of what they built)
    const portfolio = await prisma.portfolio.create({
      data: {
        missionId: mission.id,
        goalId,
        userId: session.user.id,
        problemSolved: goal.problem,
        solutionCreated: 'AI Assistant',
        reflection,
        confidenceGained: 0.25, // They gained confidence through this experience
        timeSpentMinutes: 30, // Estimated total time
        status: 'in_daily_use', // Optimistic default - they'll update as they use it
      },
    });

    // Update goal progress
    await prisma.learnerGoal.update({
      where: { id: goalId },
      data: {
        progress: 100,
        status: 'completed',
      },
    });

    return NextResponse.json({
      success: true,
      portfolioId: portfolio.id,
    });
  } catch (error) {
    console.error('Error submitting reflection:', error);
    return NextResponse.json(
      { error: 'Failed to submit reflection' },
      { status: 500 }
    );
  }
}
