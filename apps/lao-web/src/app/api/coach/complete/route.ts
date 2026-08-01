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

    const body = await request.json();
    const { goalId, messages, recommendation, step } = body;

    if (!goalId) {
      return NextResponse.json({ error: 'Missing goalId' }, { status: 400 });
    }

    // Get the goal
    const goal = await prisma.learnerGoal.findUnique({
      where: { id: goalId },
    });

    if (!goal || goal.userId !== session.user.id) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Update or create conversation
    await prisma.coachConversation.updateMany({
      where: {
        goalId,
        userId: session.user.id,
      },
      data: {
        messages: JSON.stringify(messages),
        step,
        recommendedSolution: recommendation?.skillName || 'AI Assistant',
      },
    });

    // Create a mission for this goal if recommendation exists
    let mission = null;
    if (recommendation) {
      mission = await prisma.personalMission.create({
        data: {
          goalId,
          userId: session.user.id,
          title: 'Solve Your First Real Problem with AI',
          problemArea: 'general',
          solutionType: 'AIAssistant',
          solutionDescription: recommendation.rationale,
          instructions: JSON.stringify({
            steps: [
              { step: 1, title: 'Define the task', description: 'Clarify what the AI should do' },
              { step: 2, title: 'Create the prompt', description: 'Write clear instructions for the AI' },
              { step: 3, title: 'Test with examples', description: 'Run a few test cases' },
              { step: 4, title: 'Deploy and use', description: 'Start using it in your workflow' },
            ],
          }),
          status: 'active',
        },
      });
    }

    return NextResponse.json({
      success: true,
      missionId: mission?.id,
    });
  } catch (error) {
    console.error('Error completing coach session:', error);
    return NextResponse.json(
      { error: 'Failed to complete coach session' },
      { status: 500 }
    );
  }
}
