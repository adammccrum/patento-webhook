import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateShareId } from '@/lib/solutions';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

/** Publish a read-only link to this solution, or withdraw one. */
export async function POST(
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

    const body = await request.json().catch(() => ({}));
    const shared = body?.shared !== false;

    // Keep the existing token when re-sharing so old links stay valid.
    const shareId = shared ? existing.shareId ?? generateShareId() : null;

    const solution = await prisma.solution.update({
      where: { id: params.id },
      data: { shareId },
    });

    return NextResponse.json({
      shareId: solution.shareId,
      shareUrl: solution.shareId ? `/s/${solution.shareId}` : null,
    });
  } catch (error) {
    console.error('Error updating sharing:', error);
    return NextResponse.json({ error: 'Failed to update sharing' }, { status: 500 });
  }
}
