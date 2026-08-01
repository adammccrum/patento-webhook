import { withCapability } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

export const POST = withCapability('course.read', async (request: Request, { principal }: any) => {
  try {

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
        userId: principal.userId,
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
});
