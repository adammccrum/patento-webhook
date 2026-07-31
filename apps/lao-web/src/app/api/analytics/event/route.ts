import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

interface AnalyticsEventPayload {
  eventType: string;
  sessionId: string;
  userId: string;
  goalId?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export async function POST(request: Request) {
  try {
    const body: AnalyticsEventPayload = await request.json();
    const { eventType, sessionId, userId, goalId, timestamp, metadata } = body;

    if (!eventType || !sessionId || !userId || !timestamp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify user is authenticated (but don't require it - some events may come from unauthenticated flow)
    const session = await getSession();
    if (session?.user?.id && session.user.id !== userId) {
      return NextResponse.json({ error: 'User mismatch' }, { status: 403 });
    }

    // Store event in database
    // Create table if needed: AnalyticsEvent
    // For now, log to console as placeholder
    console.log(`[ANALYTICS] ${eventType}`, {
      sessionId,
      userId,
      goalId,
      timestamp,
      metadata,
    });

    // TODO: Persist to AnalyticsEvent table
    // await prisma.analyticsEvent.create({
    //   data: {
    //     eventType,
    //     sessionId,
    //     userId,
    //     goalId,
    //     timestamp: new Date(timestamp),
    //     metadata: metadata || {},
    //   },
    // });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing analytics event:', error);
    // Never fail the event - analytics should never impact learner experience
    return NextResponse.json({ success: true });
  }
}
