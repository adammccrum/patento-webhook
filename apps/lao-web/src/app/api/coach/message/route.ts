import { withCapability, canAccessResourceOf } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

export const POST = withCapability('course.read', async (request: Request, { principal }: any) => {
  try {

    const body = await request.json();
    const { goalId, message, step, messages } = body;

    if (!goalId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get the goal to understand the problem
    const goal = await prisma.learnerGoal.findUnique({
      where: { id: goalId },
    });

    if (!goal || !canAccessResourceOf(principal, goal.userId)) {
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
      // Explore current approaches - celebrate finding a solution
      coachResponse = `That's valuable—knowing how much time this costs you means we'll be able to see the impact. **What have you tried so far?** Are you using any tools, or is this mostly manual work right now?`;
    } else if (step === 1) {
      // Ask about preferences - frame as building capability
      coachResponse = `Good foundation. So there's a real opportunity here. **If an AI could handle the parts that take the most time, what would change for you?** Would you have more focus for the high-value work? Or would it free up time for something else entirely?`;
    } else if (step === 2) {
      // Provide recommendation - focus on capability building
      coachResponse = `Perfect. Based on what you've told me, here's what we're going to build: **A simple AI tool that handles "${goal.problem}".**

It works like this:
- You give it the information it needs
- The AI does the work you described
- You get a ready-to-use result

You'll build this in about 25 minutes. Once it's working, you'll use it every week—which means you'll get that time back every week.

Let's build it?`;
      nextStep = 3;
    } else {
      // Continue building
      coachResponse = `You're building something real now. Let's keep going—step by step.`;
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
});
