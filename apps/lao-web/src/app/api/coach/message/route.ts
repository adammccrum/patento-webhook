import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { goalId, message, step, messages } = body;

    if (!goalId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the goal to understand the problem
    const goal = await prisma.learnerGoal.findUnique({
      where: { id: goalId },
    });

    if (!goal || goal.userId !== session.user.id) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Generate coach response based on step
    // Step 0: Problem - ask about time and frustration
    // Step 1: Explore - ask about current solutions
    // Step 2: Recommend - suggest AI solution
    // Step 3: Build - guide implementation

    let coachResponse = '';
    let nextStep = step + 1;

    if (step === 0) {
      // Explore current approaches
      coachResponse = `I see. So that's eating up a lot of time. Let me ask: **What have you tried so far to make this faster?** Are you using any tools, scripts, or processes? Or are you still doing it manually?`;
    } else if (step === 1) {
      // Ask about preferences
      coachResponse = `Got it. So you haven't found a good solution yet. Here's what I'm thinking: **If an AI could handle the boring parts of this task, what would excite you most?** For example, would you want it to do it faster, handle variations, or just take it off your plate entirely?`;
    } else if (step === 2) {
      // Provide recommendation
      coachResponse = `Perfect. Based on what you've told me, I have a recommendation: **We can build a simple AI assistant that will handle the repetitive parts of this task.**

Here's what we'll create:
- **Input:** Your task details (whatever you'd normally prepare)
- **Process:** AI analyzes and handles it intelligently
- **Output:** Ready-to-use result

This usually takes about 20-30 minutes to set up. Once it's working, you'll save that time every single time you use it.

Ready to build it together?`;
      nextStep = 3;
    } else {
      // Continue building
      coachResponse = `Great! Let's move to the build phase. I'll guide you step-by-step through setting up your AI assistant.`;
    }

    // Determine if we should proceed to solution based on exploration
    // After step 2, we have enough info to recommend
    let recommendedAction = null;

    if (nextStep >= 2) {
      // Generate a simple recommendation action
      recommendedAction = {
        actionType: 'learn',
        skillId: 'ai-assistant-building',
        skillName: 'Build AI Assistant',
        expectedBenefitScore: 85,
        timeEstimateMinutes: 25,
        difficultyLevel: 'beginner',
        rationale: `Build an AI assistant to solve: ${goal.problem}`,
      };
    }

    return NextResponse.json({
      response: coachResponse,
      step: nextStep,
      recommendedAction,
    });
  } catch (error) {
    console.error('Error generating coach message:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}
