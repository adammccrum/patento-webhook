import { withCapability } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

interface AnalyticsEventPayload {
  eventType: string;
  sessionId: string;
  userId: string;
  goalId?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export const POST = withCapability('account.read', async (request: Request, { principal }: any) => {
  try {
    const body: AnalyticsEventPayload = await request.json();
    const { eventType, sessionId, userId, goalId, timestamp, metadata } = body;

    if (!eventType || !sessionId || !userId || !timestamp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Events are always attributed to the caller, never to whoever the body
    // claims. A learner cannot write events into someone else's history.
    if (principal.userId !== userId) {
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 });
    }

    // goalId is a real foreign key; a stale one from the client would fail the
    // insert and lose the event, so only keep it if the goal still exists and
    // belongs to this learner.
    const linkedGoalId = goalId
      ? (
          await prisma.learnerGoal.findFirst({
            where: { id: goalId, userId: principal.userId },
            select: { id: true },
          })
        )?.id ?? null
      : null;

    await prisma.analyticsEvent.create({
      data: {
        eventType,
        sessionId,
        userId: principal.userId,
        goalId: linkedGoalId,
        metadata: metadata ?? {},
        // The client's clock is not trusted for ordering, but the reported
        // time is worth keeping alongside the server's own createdAt.
        ...(timestamp ? { metadata: { ...(metadata ?? {}), clientTimestamp: timestamp } } : {}),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing analytics event:', error);
    // Never fail the event - analytics should never impact learner experience
    return NextResponse.json({ success: true });
  }
});
