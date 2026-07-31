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
    const { goalId, stepData } = body;

    if (!goalId) {
      return NextResponse.json({ error: 'Missing goalId' }, { status: 400 });
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
      where: { goalId, userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Create an Asset for the built AI assistant
    const asset = await prisma.asset.create({
      data: {
        missionId: mission.id,
        userId: session.user.id,
        name: 'AI Assistant',
        description: `AI assistant for: ${goal.problem}`,
        type: 'assistant',
        content: JSON.stringify({
          task: stepData[1] || '',
          instructions: stepData[2] || '',
          testInput: stepData[3] || '',
          createdAt: new Date().toISOString(),
        }),
        isInUseToday: false,
        useCount: 0,
      },
    });

    // Update mission status
    await prisma.mission.update({
      where: { id: mission.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        confidenceAtEnd: 0.8,
        timeSpent: 25, // Estimated time
      },
    });

    // Update learner state
    let learnerState = await prisma.learnerState.findUnique({
      where: { userId: session.user.id },
    });

    if (!learnerState) {
      learnerState = await prisma.learnerState.create({
        data: {
          userId: session.user.id,
          overallConfidence: 0.7,
          problemsSolved: 1,
        },
      });
    } else {
      await prisma.learnerState.update({
        where: { userId: session.user.id },
        data: {
          problemsSolved: (learnerState.problemsSolved || 0) + 1,
          overallConfidence: Math.min(1, (learnerState.overallConfidence || 0.5) + 0.2),
        },
      });
    }

    return NextResponse.json({
      success: true,
      assetId: asset.id,
      missionId: mission.id,
    });
  } catch (error) {
    console.error('Error completing build:', error);
    return NextResponse.json(
      { error: 'Failed to complete build' },
      { status: 500 }
    );
  }
}
