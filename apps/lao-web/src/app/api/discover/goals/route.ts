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
    const { problem, description, problemArea, timeframe } = body;

    if (!problem || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create a LearnerGoal record
    const goal = await prisma.learnerGoal.create({
      data: {
        userId: session.user.id,
        problem,
        description,
        timeframe: timeframe || '4 weeks',
        confidence: 0.5,
        status: 'active',
        progress: 0,
      },
    });

    return NextResponse.json({
      goalId: goal.id,
      goal,
    });
  } catch (error) {
    console.error('Error creating goal:', error);
    return NextResponse.json(
      { error: 'Failed to create goal' },
      { status: 500 }
    );
  }
}
