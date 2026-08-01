// PUBLIC ROUTE — deliberately requires no capability. See the authorization
// coverage test, which fails if a route is neither capability-gated nor listed.
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

/**
 * Read-only view of a shared solution. Deliberately public — no session check.
 *
 * Only what the owner chose to publish is returned: the tool itself and what
 * it is for. Private notes, usage history and the owner's identity stay out.
 */
export async function GET(
  request: Request,
  { params }: { params: { shareId: string } }
) {
  try {
    const solution = await prisma.solution.findUnique({
      where: { shareId: params.shareId },
      select: {
        name: true,
        problem: true,
        problemArea: true,
        content: true,
        currentVersion: true,
        timeSavedMinutes: true,
        createdAt: true,
      },
    });

    if (!solution) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ solution });
  } catch (error) {
    console.error('Error loading shared solution:', error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}
