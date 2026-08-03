import { withCapability, canAccessResourceOf } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

export const GET = withCapability('course.read', async (request: Request, { principal }: any) => {
  try {

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

    if (!goal || !canAccessResourceOf(principal, goal.userId)) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Check if conversation exists
    let conversation = await prisma.coachConversation.findFirst({
      where: { goalId, userId: principal.userId },
      orderBy: { createdAt: 'desc' },
    });

    // Create new conversation if it doesn't exist
    if (!conversation) {
      conversation = await prisma.coachConversation.create({
        data: {
          userId: principal.userId,
          goalId,
          step: 0,
          messages: JSON.stringify([]),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        },
      });
    }

    // Initial coach message - celebrate and explore
    const initialMessage = `Great—that's the kind of problem worth solving. "${goal.problem}" is something you deal with regularly, which means any time we save here compounds every single week.

Let's understand it better: **How much time does this actually take you?** Is it 10 minutes a day? An hour a week? And what part is the most annoying—is it the repetition, the detail work, or something else?`;

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
});
