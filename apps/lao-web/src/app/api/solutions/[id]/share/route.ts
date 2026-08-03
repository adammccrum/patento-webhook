import { withCapability, canAccessResourceOf } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { generateShareId } from '@/lib/solutions';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

/** Publish a read-only link to this solution, or withdraw one. */
export const POST = withCapability('solution.share', async (request: Request, { params, principal }: any) => {
  try {

    const existing = await prisma.solution.findUnique({ where: { id: params.id } });

    if (!existing || !canAccessResourceOf(principal, existing.userId)) {
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
});
