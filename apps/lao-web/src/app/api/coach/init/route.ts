import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const goalId = searchParams.get('goalId');

    if (!goalId) {
      return NextResponse.json({ error: 'Missing goalId' }, { status: 400 });
    }

    // Get the goal
    const goal = await prisma.learnerGoal.findUnique({
      where: { id: goalId },
      include: {
        user: true,
      },
    });

    if (!goal || goal.userId !== session.user.id) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Check if conversation exists
    let conversation = await prisma.coachConversation.findFirst({
      where: { goalId, userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    // Create new conversation if it doesn't exist
    if (!conversation) {
      conversation = await prisma.coachConversation.create({
        data: {
          missionId: '', // Will be set later when mission is created
          userId: session.user.id,
          goalId,
          step: 0,
          messages: JSON.stringify([]),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        },
      });
    }

    // Initial coach message - ask about the problem
    const initialMessage = `I'm your AI Coach, and I'm here to help you solve "${goal.problem}" using AI.

First, let me understand this better: **How much time does this task take you each day or week?** And what specifically makes it frustrating or time-consuming?`;

    return NextResponse.json({
      goal,
      conversation,
      initialMessage,
    });
  } catch (error) {
    console.error('Error initializing coach:', error);
    return NextResponse.json(
      { error: 'Failed to initialize coach' },
      { status: 500 }
    );
  }
}
