import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCollaboratorPrompt } from '@/lib/solutions';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

/** The workspace: the solution, its story, and what we've noticed about it. */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const solution = await prisma.solution.findUnique({
      where: { id: params.id },
      include: {
        versions: { orderBy: { version: 'desc' } },
        runs: { orderBy: { ranAt: 'desc' }, take: 10 },
      },
    });

    if (!solution || solution.userId !== session.user.id) {
      return NextResponse.json({ error: 'Solution not found' }, { status: 404 });
    }

    return NextResponse.json({
      solution,
      collaborator: getCollaboratorPrompt(solution),
    });
  } catch (error) {
    console.error('Error loading solution:', error);
    return NextResponse.json({ error: 'Failed to load solution' }, { status: 500 });
  }
}

/**
 * Update a solution.
 *
 * Renaming, re-noting and archiving edit in place. Changing the content is
 * different — that is the solution evolving, so it always creates a new
 * version and leaves the old one intact.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.solution.findUnique({ where: { id: params.id } });

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Solution not found' }, { status: 404 });
    }

    const { name, problem, notes, content, changeNote, status, timeSavedMinutes } =
      await request.json();

    const data: Record<string, unknown> = {};

    if (typeof name === 'string' && name.trim()) data.name = name.trim();
    if (typeof problem === 'string' && problem.trim()) data.problem = problem.trim();
    if (typeof notes === 'string') data.notes = notes;
    if (status === 'active' || status === 'archived') data.status = status;
    if (Number.isFinite(timeSavedMinutes)) {
      data.timeSavedMinutes = Math.max(0, timeSavedMinutes);
    }

    // Content changes create a version. Identical content is not a change.
    const contentChanged =
      typeof content === 'string' && content.trim() && content.trim() !== existing.content;

    if (!contentChanged && Object.keys(data).length === 0) {
      return NextResponse.json({ solution: existing, versioned: false });
    }

    // Version numbers are unique per solution, so derive the next one inside a
    // transaction. Two people improving at once would otherwise collide.
    const solution = await prisma.$transaction(async (tx) => {
      if (contentChanged) {
        const latest = await tx.solutionVersion.findFirst({
          where: { solutionId: params.id },
          orderBy: { version: 'desc' },
          select: { version: true },
        });

        const nextVersion = (latest?.version ?? existing.currentVersion) + 1;
        data.content = content.trim();
        data.currentVersion = nextVersion;
        data.versions = {
          create: {
            version: nextVersion,
            content: content.trim(),
            changeNote:
              typeof changeNote === 'string' && changeNote.trim() ? changeNote.trim() : null,
          },
        };
      }

      return tx.solution.update({
        where: { id: params.id },
        data,
        include: { versions: { orderBy: { version: 'desc' } } },
      });
    });

    return NextResponse.json({ solution, versioned: contentChanged });
  } catch (error) {
    console.error('Error updating solution:', error);
    return NextResponse.json({ error: 'Failed to update solution' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await prisma.solution.findUnique({ where: { id: params.id } });

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: 'Solution not found' }, { status: 404 });
    }

    await prisma.solution.delete({ where: { id: params.id } });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Error deleting solution:', error);
    return NextResponse.json({ error: 'Failed to delete solution' }, { status: 500 });
  }
}
