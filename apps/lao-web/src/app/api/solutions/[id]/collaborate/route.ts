import { withCapability, canAccessResourceOf } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import {
  COLLABORATOR_INTENTS,
  CollaboratorUnavailable,
  collaborate,
  type CollaboratorIntent,
} from '@/lib/collaborator';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

/** The ongoing conversation about this solution. */
export const GET = withCapability(
  'solution.read',
  async (_request: Request, { params, principal }: any) => {
    try {
      const solution = await prisma.solution.findUnique({
        where: { id: params.id },
        select: { userId: true },
      });

      if (!solution || !canAccessResourceOf(principal, solution.userId)) {
        return NextResponse.json({ error: 'Solution not found' }, { status: 404 });
      }

      const conversation = await prisma.solutionConversation.findUnique({
        where: { solutionId: params.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      return NextResponse.json({
        messages: (conversation?.messages ?? []).map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          intent: m.intent,
          proposedContent: m.proposedContent,
          acceptedVersion: m.acceptedVersion,
          createdAt: m.createdAt,
        })),
      });
    } catch (error) {
      console.error('Error loading conversation:', error);
      return NextResponse.json({ error: 'Failed to load conversation' }, { status: 500 });
    }
  }
);

/** Say something to the collaborator about this solution. */
export const POST = withCapability(
  'solution.write',
  async (request: Request, { params, principal }: any) => {
    try {
      const solution = await prisma.solution.findUnique({
        where: { id: params.id },
        include: { versions: { orderBy: { version: 'desc' }, take: 10 } },
      });

      if (!solution || !canAccessResourceOf(principal, solution.userId)) {
        return NextResponse.json({ error: 'Solution not found' }, { status: 404 });
      }

      const body = await request.json().catch(() => ({}));
      const intent: CollaboratorIntent = COLLABORATOR_INTENTS.includes(body?.intent)
        ? body.intent
        : 'improve';
      const message = typeof body?.message === 'string' ? body.message : undefined;

      const conversation = await prisma.solutionConversation.upsert({
        where: { solutionId: params.id },
        update: {},
        create: { solutionId: params.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      // The collaborator remembers the solution, so only recent turns are
      // replayed — the standing context comes from the solution itself.
      const history = conversation.messages.slice(-10).map((m) => ({
        role: m.role as 'learner' | 'collaborator',
        content: m.content,
      }));

      let response;
      try {
        response = await collaborate({
          intent,
          message,
          history,
          requestId: `${params.id}:${Date.now()}`,
          tenantId: principal.userId,
          // Abort generation if the learner navigates away.
          signal: request.signal,
          solution: {
            name: solution.name,
            problem: solution.problem,
            problemArea: solution.problemArea,
            content: solution.content,
            notes: solution.notes,
            currentVersion: solution.currentVersion,
            useCount: solution.useCount,
            lastUsedAt: solution.lastUsedAt,
            timeSavedMinutes: solution.timeSavedMinutes,
            totalTimeSavedMinutes: solution.totalTimeSavedMinutes,
            createdAt: solution.createdAt,
            versions: solution.versions.map((v) => ({
              version: v.version,
              changeNote: v.changeNote,
              createdAt: v.createdAt,
            })),
          },
        });
      } catch (error) {
        if (error instanceof CollaboratorUnavailable) {
          return NextResponse.json(
            { error: error.message, retryable: error.retryable },
            { status: 503 }
          );
        }
        throw error;
      }

      // Record both sides so the thread survives the visit.
      const [learnerMessage, collaboratorMessage] = await prisma.$transaction([
        prisma.solutionMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'learner',
            content: message?.trim() || defaultLabel(intent),
            intent,
          },
        }),
        prisma.solutionMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'collaborator',
            content: response.reply,
            intent,
            proposedContent: response.proposedContent ?? null,
            servedByModel: response.servedByModel,
          },
        }),
      ]);

      return NextResponse.json({
        learnerMessage: { id: learnerMessage.id, content: learnerMessage.content },
        message: {
          id: collaboratorMessage.id,
          role: 'collaborator',
          content: response.reply,
          proposedContent: response.proposedContent ?? null,
          createdAt: collaboratorMessage.createdAt,
        },
        changeSummary: response.changeSummary ?? null,
        // True when no provider is configured, so the UI can say so plainly.
        degraded: response.degraded,
      });
    } catch (error) {
      console.error('Error in collaboration:', error);
      return NextResponse.json({ error: 'Failed to reach the collaborator' }, { status: 500 });
    }
  }
);

function defaultLabel(intent: CollaboratorIntent): string {
  switch (intent) {
    case 'improve':
      return "Let's make this better.";
    case 'explain':
      return 'Explain how this works.';
    case 'diagnose':
      return "Something isn't working right.";
    case 'draft':
      return 'Help me start this.';
  }
}
