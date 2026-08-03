/**
 * The Collaborator.
 *
 * A teammate who knows one tool well. It is told everything the product knows
 * about a solution — why it exists, how it has changed, how often it is used,
 * what the learner noted — so the learner never has to explain themselves twice.
 *
 * This module owns LAO's voice. Adapters translate; they never add. That is why
 * changing provider cannot change how the collaborator sounds.
 *
 * Nothing here names a vendor, and nothing here writes to a solution: a
 * proposal is shown to the learner, who accepts it through the normal
 * versioning path.
 */

import { LLMError, type CallContext, type ModelRequest } from '@iriskey/llm';
import { getRouter } from './llm';
import { formatLastUsed, formatMinutes } from './solutions';

export type CollaboratorIntent = 'improve' | 'explain' | 'diagnose' | 'draft';

export const COLLABORATOR_INTENTS: CollaboratorIntent[] = [
  'improve',
  'explain',
  'diagnose',
  'draft',
];

/** Everything the collaborator knows about the tool being discussed. */
export interface SolutionContext {
  name: string;
  problem: string;
  problemArea: string;
  content: string;
  notes: string | null;
  currentVersion: number;
  useCount: number;
  lastUsedAt: Date | string | null;
  timeSavedMinutes: number;
  totalTimeSavedMinutes: number;
  createdAt: Date | string;
  /** Most recent first. */
  versions: Array<{ version: number; changeNote: string | null; createdAt: Date | string }>;
}

export interface CollaboratorTurn {
  role: 'learner' | 'collaborator';
  content: string;
}

export interface CollaboratorRequest {
  intent: CollaboratorIntent;
  solution: SolutionContext;
  message?: string;
  history?: CollaboratorTurn[];
  requestId: string;
  tenantId: string;
  signal: AbortSignal;
}

export interface CollaboratorResponse {
  reply: string;
  /** A revision to show as a diff. Never saved without the learner accepting. */
  proposedContent?: string;
  /** One line, suitable as a version note. */
  changeSummary?: string;
  /** Operational only. Never rendered. */
  servedByModel: string;
  degraded: boolean;
}

export class CollaboratorUnavailable extends Error {
  constructor(
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = 'CollaboratorUnavailable';
  }
}

/* ------------------------------------------------------------------ prompts */

const VOICE = `You are the learner's collaborator on one specific tool they built and rely on.

How you work:
- You are a teammate, not a tutor and not an assistant. Talk about the work, not about AI.
- Never mention prompts, prompt engineering, models, tokens, or yourself as an AI.
- The learner built this. It is theirs. You help it get better; you do not take it over.
- Be concrete and brief. Two or three sentences of reply is usually right.
- When you change something, say what you changed and why, in plain words.
- If you do not have enough information, ask one specific question rather than guessing.
- Never invent facts about how often something is used. You are given the real numbers.`;

const INTENT_GUIDANCE: Record<CollaboratorIntent, string> = {
  improve:
    'The learner wants this tool to work better. Propose a concrete revision of its content. ' +
    'Change what needs changing and leave the rest alone — a rewrite they do not recognise is worse than no change.',
  explain:
    'The learner wants to understand something about this tool. Explain it plainly. Do not propose a revision.',
  diagnose:
    'Something went wrong. Work out the likely cause from what the tool actually says. ' +
    'If a change would fix it, propose one; if you need to see the bad output first, ask for it.',
  draft:
    'The tool is empty or barely started. Draft a first version that solves the stated problem, ' +
    'simple enough that the learner can read it and understand every line.',
};

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: {
      type: 'string',
      description: "What you say to the learner. Plain language, two or three sentences.",
    },
    proposedContent: {
      type: 'string',
      description:
        'The full revised content of the tool, if you are proposing a change. Omit entirely if not.',
    },
    changeSummary: {
      type: 'string',
      description: 'A short note describing the change, e.g. "Added tone guidance". Omit if no change.',
    },
  },
  required: ['reply'],
  additionalProperties: false,
} as const;

/** Everything we know, written the way one colleague briefs another. */
export function buildContextBrief(s: SolutionContext): string {
  const lines: string[] = [
    `The tool is called "${s.name}".`,
    `It exists to solve: ${s.problem}`,
    `Area: ${s.problemArea}`,
    '',
    'How it is going:',
  ];

  if (s.useCount === 0) {
    lines.push('- Not used yet. It may not fit their workflow.');
  } else {
    lines.push(`- Used ${s.useCount} time${s.useCount === 1 ? '' : 's'}, last ${formatLastUsed(s.lastUsedAt)}.`);
    if (s.totalTimeSavedMinutes > 0) {
      lines.push(`- Has saved about ${formatMinutes(s.totalTimeSavedMinutes)} in total.`);
    }
  }

  lines.push(
    `- Currently on version ${s.currentVersion}${
      s.currentVersion === 1 ? ' (never revised since it was built)' : ''
    }.`
  );

  const revisions = s.versions.filter((v) => v.changeNote).slice(0, 5);
  if (revisions.length > 0) {
    lines.push('', 'How it has changed:');
    for (const v of revisions) {
      lines.push(`- v${v.version}: ${v.changeNote}`);
    }
  }

  if (s.notes?.trim()) {
    lines.push('', "The learner's own notes on it:", s.notes.trim());
  }

  lines.push('', 'The tool, exactly as it stands now:', '---', s.content, '---');

  return lines.join('\n');
}

function buildMessages(req: CollaboratorRequest): ModelRequest['messages'] {
  const messages: ModelRequest['messages'] = [
    { role: 'user', content: buildContextBrief(req.solution) },
    {
      role: 'assistant',
      content: "Understood. I know this tool and how it's been going. What do you need?",
    },
  ];

  // Prior turns, so the learner never repeats themselves across visits.
  for (const turn of req.history ?? []) {
    messages.push({
      role: turn.role === 'learner' ? 'user' : 'assistant',
      content: turn.content,
    });
  }

  const opener = req.message?.trim() || defaultOpener(req.intent);
  messages.push({
    role: 'user',
    content: `${opener}\n\n(${INTENT_GUIDANCE[req.intent]})`,
  });

  return messages;
}

function defaultOpener(intent: CollaboratorIntent): string {
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

/* ------------------------------------------------------------------- engine */

/** Injectable so the collaborator's behaviour can be tested without a provider. */
export interface CollaboratorDeps {
  router: Pick<ReturnType<typeof getRouter>['router'], 'run'>;
  degraded: boolean;
}

export async function collaborate(
  req: CollaboratorRequest,
  deps?: CollaboratorDeps
): Promise<CollaboratorResponse> {
  const { router, degraded } = deps ?? getRouter();

  const modelRequest: ModelRequest = {
    system: VOICE,
    messages: buildMessages(req),
    maxOutputTokens: 2_000,
    temperature: 0.4,
    responseSchema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
  };

  const ctx: CallContext = {
    signal: req.signal,
    tenantId: req.tenantId,
    requestId: req.requestId,
  };

  try {
    const { result, trace } = await router.run(modelRequest, ctx, {
      // A proposal has to come back as data, not prose, or we cannot diff it.
      needsStructuredOutput: true,
      prefer: req.intent === 'explain' ? 'speed' : 'quality',
    });

    const parsed = coerce(result.structured, result.text);

    return {
      reply: parsed.reply,
      // Only these intents may change the tool. An explanation that quietly
      // rewrote someone's work would be a betrayal of the relationship.
      proposedContent:
        req.intent === 'explain' ? undefined : nonEmpty(parsed.proposedContent),
      changeSummary: req.intent === 'explain' ? undefined : nonEmpty(parsed.changeSummary),
      servedByModel: trace.modelId,
      degraded,
    };
  } catch (error) {
    throw toUnavailable(error);
  }
}

interface ParsedResponse {
  reply: string;
  proposedContent?: string;
  changeSummary?: string;
}

/** Accept the structured result, falling back to prose if a model returned only text. */
function coerce(structured: unknown, text: string): ParsedResponse {
  if (structured && typeof structured === 'object') {
    const s = structured as Record<string, unknown>;
    if (typeof s.reply === 'string' && s.reply.trim()) {
      return {
        reply: s.reply.trim(),
        proposedContent: typeof s.proposedContent === 'string' ? s.proposedContent : undefined,
        changeSummary: typeof s.changeSummary === 'string' ? s.changeSummary : undefined,
      };
    }
  }

  if (text.trim()) {
    return { reply: text.trim() };
  }

  throw new CollaboratorUnavailable('The collaborator returned nothing usable.', true);
}

function nonEmpty(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Translate an infrastructure failure into something a learner can read.
 * No vendor names, no status codes, no raw provider text.
 */
function toUnavailable(error: unknown): CollaboratorUnavailable {
  if (error instanceof CollaboratorUnavailable) return error;

  if (error instanceof LLMError) {
    switch (error.code) {
      case 'CANCELLED':
        return new CollaboratorUnavailable('Cancelled.', false);
      case 'CONTENT_FILTERED':
        return new CollaboratorUnavailable(
          'That request was refused. Try describing the change in different words.',
          false
        );
      case 'BUDGET_EXCEEDED':
        return new CollaboratorUnavailable(
          "You've used your available credits for now.",
          false
        );
      case 'INVALID_REQUEST':
        // Our bug, not theirs — say so without the detail.
        return new CollaboratorUnavailable(
          'Something went wrong on our side. Your solution is unchanged.',
          false
        );
      default:
        return new CollaboratorUnavailable(
          "The collaborator isn't available right now. Your solution is unchanged.",
          true
        );
    }
  }

  return new CollaboratorUnavailable(
    "The collaborator isn't available right now. Your solution is unchanged.",
    true
  );
}
