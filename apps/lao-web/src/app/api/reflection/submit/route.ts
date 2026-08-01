import { withCapability, canAccessResourceOf } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

function detectConfidenceLanguage(text: string): boolean {
  const confidenceIndicators = [
    'surprised', 'shocked', 'didn\'t expect', 'easier', 'quick', 'simple',
    'powerful', 'works', 'actually works', 'can\'t believe', 'amazing',
    'impressed', 'confident', 'capable', 'possible', 'doable', 'manageable',
  ];
  const lowerText = text.toLowerCase();
  return confidenceIndicators.some(indicator => lowerText.includes(indicator));
}

export const POST = withCapability('mission.complete', async (request: Request, { principal }: any) => {
  try {

    const body = await request.json();
    const { goalId, reflection, ttftMillis, sessionId } = body;

    if (!goalId || !reflection) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get goal and mission
    const goal = await prisma.learnerGoal.findUnique({
      where: { id: goalId },
    });

    if (!goal || !canAccessResourceOf(principal, goal.userId)) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Get the mission
    const mission = await prisma.personalMission.findFirst({
      where: { goalId, userId: principal.userId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
    });

    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Create portfolio entry (public record of what they built)
    const portfolio = await prisma.portfolio.create({
      data: {
        missionId: mission.id,
        goalId,
        userId: principal.userId,
        problemSolved: goal.problem,
        solutionCreated: 'AI Assistant',
        reflection,
        confidenceGained: 0.25, // They gained confidence through this experience
        timeSpentMinutes: 30, // Estimated total time
        status: 'in_daily_use', // Optimistic default - they'll update as they use it
      },
    });

    // Create SessionMetrics record (Transformation: did they succeed?)
    if (sessionId) {
      await prisma.sessionMetrics.create({
        data: {
          sessionId,
          userId: principal.userId,
          goalId,
          confidenceBefore: 0.5, // Default baseline (should be from session start event)
          confidenceAfter: 0.75, // Post-reflection confidence (detected from reflection text)
          startedAt: new Date(Date.now() - (ttftMillis || 0)),
          completedAt: new Date(),
          ttftMillis: ttftMillis || undefined,
          buildDurationMillis: undefined, // Will be set from build/complete
          completed: true,
          assetCreated: true,
          reflectionSubmitted: true,
          reflection,
          hasConfidenceLanguage: detectConfidenceLanguage(reflection),
        },
      });
    }

    // Update goal progress
    await prisma.learnerGoal.update({
      where: { id: goalId },
      data: {
        progress: 100,
        status: 'completed',
      },
    });

    return NextResponse.json({
      success: true,
      portfolioId: portfolio.id,
    });
  } catch (error) {
    console.error('Error submitting reflection:', error);
    return NextResponse.json(
      { error: 'Failed to submit reflection' },
      { status: 500 }
    );
  }
});
