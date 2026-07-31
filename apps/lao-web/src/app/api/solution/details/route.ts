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
    });

    if (!goal || goal.userId !== session.user.id) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Get the associated mission
    const mission = await prisma.mission.findFirst({
      where: { goalId, userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    return NextResponse.json({
      goal,
      mission,
    });
  } catch (error) {
    console.error('Error fetching solution:', error);
    return NextResponse.json(
      { error: 'Failed to fetch solution' },
      { status: 500 }
    );
  }
}
