import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

/** The toolbox: every solution this learner owns, most recently used first. */
export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // status: active (default), archived, or all — archived solutions must stay
    // reachable, otherwise archiving silently loses them.
    const statusParam = searchParams.get('status');
    const status =
      statusParam === 'archived' || statusParam === 'all' ? statusParam : 'active';

    const search = searchParams.get('search')?.trim();
    const area = searchParams.get('area')?.trim();

    // sort: recent (default, by last use), name, or created
    const sort = searchParams.get('sort');
    const orderBy =
      sort === 'name'
        ? [{ name: 'asc' as const }]
        : sort === 'created'
          ? [{ createdAt: 'desc' as const }]
          : [
              { lastUsedAt: { sort: 'desc' as const, nulls: 'last' as const } },
              { createdAt: 'desc' as const },
            ];

    const solutions = await prisma.solution.findMany({
      where: {
        userId: session.user.id,
        ...(status === 'all' ? {} : { status }),
        ...(area && area !== 'All' ? { problemArea: area } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { problem: { contains: search, mode: 'insensitive' as const } },
                { content: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy,
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

    // The summary describes the whole toolbox, not the current filter, so the
    // headline numbers don't shift while searching.
    const all = await prisma.solution.findMany({
      where: { userId: session.user.id, status: 'active' },
      select: { useCount: true, timeSavedMinutes: true, totalTimeSavedMinutes: true },
    });

    const areas = await prisma.solution.findMany({
      where: { userId: session.user.id },
      select: { problemArea: true },
      distinct: ['problemArea'],
      orderBy: { problemArea: 'asc' },
    });

    return NextResponse.json({
      solutions,
      areas: areas.map((a) => a.problemArea),
      summary: {
        total: all.length,
        inDailyUse: all.filter((s) => s.useCount > 0).length,
        weeklyTimeSaved: all.reduce(
          (total, s) => total + (s.useCount > 0 ? s.timeSavedMinutes : 0),
          0
        ),
        totalTimeSaved: all.reduce((t, s) => t + s.totalTimeSavedMinutes, 0),
        archived: await prisma.solution.count({
          where: { userId: session.user.id, status: 'archived' },
        }),
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
