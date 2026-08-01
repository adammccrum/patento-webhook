import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * Fork a solution into a new one.
 *
 * The copy starts fresh: its own version 1, no usage history, not shared.
 * Useful when a tool almost fits a second job but shouldn't change for the first.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const source = await prisma.solution.findUnique({ where: { id: params.id } });

    if (!source || source.userId !== session.user.id) {
      return NextResponse.json({ error: 'Solution not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const name =
      typeof body?.name === 'string' && body.name.trim()
        ? body.name.trim()
        : `${source.name} (copy)`;

    const solution = await prisma.solution.create({
      data: {
        userId: session.user.id,
        name,
        problem: source.problem,
        problemArea: source.problemArea,
        content: source.content,
        notes: source.notes,
        timeSavedMinutes: source.timeSavedMinutes,
        originMissionId: source.originMissionId,
        originCourseId: source.originCourseId,
        versions: {
          create: {
            version: 1,
            content: source.content,
            changeNote: `Copied from "${source.name}" v${source.currentVersion}`,
          },
        },
      },
    });

    return NextResponse.json({ solution }, { status: 201 });
  } catch (error) {
    console.error('Error duplicating solution:', error);
    return NextResponse.json({ error: 'Failed to duplicate solution' }, { status: 500 });
  }
}
