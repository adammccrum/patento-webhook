import { withCapability, canAccessResourceOf } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

export const POST = withCapability('mission.complete', async (request: Request, { principal }: any) => {
  try {

    const body = await request.json();
    const { goalId, step, input } = body;

    if (!goalId || !step || !input) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify goal exists and belongs to user
    const goal = await prisma.learnerGoal.findUnique({
      where: { id: goalId },
    });

    if (!goal || !canAccessResourceOf(principal, goal.userId)) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // Generate coach feedback based on step
    let response = '';

    if (step === 1) {
      // Step 1: Defined the task, now give feedback and ask about prompt
      response = `Perfect! So the AI should "${input.substring(0, 50)}...". That's clear and specific.

Now I need to know: what format do you want the output in? Should it be bullet points, a summary, code, a list, or something else?`;
    } else if (step === 2) {
      // Step 2: Got instructions, now ready to test
      response = `Excellent instructions. You've been very specific about what you want.

Now let's test it with real data. Show me an example of what the AI would work on. This helps us see if our setup is correct before you use it in real life.`;
    } else if (step === 3) {
      // Step 3: Got test input, provide sample output
      response = `Perfect test case. Based on your instructions, here's what the AI would output:

---
**AI Output:**
Key action items:
• Johnson proposal review due Friday
• Need to provide quote for phase 2

---

Does this look right? If yes, you're ready to start using it!`;
    } else {
      response = `Great! Your AI assistant is ready to deploy.`;
    }

    return NextResponse.json({
      response,
      step,
    });
  } catch (error) {
    console.error('Error processing build step:', error);
    return NextResponse.json(
      { error: 'Failed to process step' },
      { status: 500 }
    );
  }
});
