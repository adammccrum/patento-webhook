import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/** The toolbox: every solution this learner owns, most recently used first. */
export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    const solutions = await prisma.solution.findMany({
      where: {
        userId: session.user.id,
        ...(includeArchived ? {} : { status: 'active' }),
      },
      orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        problem: true,
        problemArea: true,
        currentVersion: true,
        useCount: true,
        lastUsedAt: true,
        timeSavedMinutes: true,
        totalTimeSavedMinutes: true,
        shareId: true,
        status: true,
        createdAt: true,
      },
    });

    const weeklyTimeSaved = solutions.reduce(
      (total, s) => total + (s.useCount > 0 ? s.timeSavedMinutes : 0),
      0
    );

    return NextResponse.json({
      solutions,
      summary: {
        total: solutions.length,
        inDailyUse: solutions.filter((s) => s.useCount > 0).length,
        weeklyTimeSaved,
        totalTimeSaved: solutions.reduce((t, s) => t + s.totalTimeSavedMinutes, 0),
      },
    });
  } catch (error) {
    console.error('Error listing solutions:', error);
    return NextResponse.json({ error: 'Failed to load solutions' }, { status: 500 });
  }
}

/** Create a solution directly in the toolbox, outside any course. */
export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, problem, problemArea, content, timeSavedMinutes } = await request.json();

    if (!name?.trim() || !problem?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: 'A solution needs a name, the problem it solves, and its content' },
        { status: 400 }
      );
    }

    const solution = await prisma.solution.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        problem: problem.trim(),
        problemArea: problemArea?.trim() || 'General',
        content: content.trim(),
        timeSavedMinutes: Number.isFinite(timeSavedMinutes) ? Math.max(0, timeSavedMinutes) : 0,
        versions: {
          create: {
            version: 1,
            content: content.trim(),
            changeNote: 'Created',
          },
        },
      },
    });

    return NextResponse.json({ solution }, { status: 201 });
  } catch (error) {
    console.error('Error creating solution:', error);
    return NextResponse.json({ error: 'Failed to create solution' }, { status: 500 });
  }
}
