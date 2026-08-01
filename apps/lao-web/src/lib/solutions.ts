/**
 * Solution helpers.
 *
 * The toolbox is where a solution stays alive, so most of the logic here is
 * about noticing how a solution is actually being used and saying something
 * useful about it. Nothing here talks to a model — these are observations
 * drawn from real usage, which is why they can be specific.
 */

export interface SolutionUsage {
  useCount: number;
  lastUsedAt: Date | string | null;
  currentVersion: number;
  createdAt: Date | string;
  totalTimeSavedMinutes: number;
}

export interface CollaboratorPrompt {
  /** What the assistant noticed, stated plainly. */
  observation: string;
  /** The question it opens up. Always optional to act on. */
  question: string;
  /** Which situation triggered this, for analytics. */
  kind: 'unused' | 'settling_in' | 'relied_on' | 'stale_version' | 'dormant' | 'new';
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(date: Date | string | null): number | null {
  if (!date) return null;
  const then = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / DAY_MS);
}

/**
 * Look at how a solution has actually been used and surface one observation.
 *
 * Returns a single prompt rather than a list — the workspace should feel like
 * a collaborator making one remark, not a dashboard of suggestions.
 */
export function getCollaboratorPrompt(usage: SolutionUsage): CollaboratorPrompt {
  const sinceLastUse = daysSince(usage.lastUsedAt);
  const age = daysSince(usage.createdAt) ?? 0;

  // Never used, and it's had time to be used.
  if (usage.useCount === 0 && age >= 3) {
    return {
      kind: 'unused',
      observation: "You built this but haven't used it yet.",
      question: 'Does it need changing before it fits your workflow?',
    };
  }

  if (usage.useCount === 0) {
    return {
      kind: 'new',
      observation: 'This one is new.',
      question: 'Use it once and see whether it holds up on real work.',
    };
  }

  // Used to be a habit, then stopped.
  if (sinceLastUse !== null && sinceLastUse >= 21 && usage.useCount >= 3) {
    return {
      kind: 'dormant',
      observation: `You used this ${usage.useCount} times, but not in the last ${sinceLastUse} days.`,
      question: 'Has your workflow changed, or did it stop working well?',
    };
  }

  // Genuinely relied on, but never improved past its original version.
  if (usage.useCount >= 10 && usage.currentVersion === 1) {
    return {
      kind: 'stale_version',
      observation: `You've used this ${usage.useCount} times and it's still on the first version.`,
      question: "You'll have noticed things by now. Want to improve it together?",
    };
  }

  if (usage.useCount >= 10) {
    return {
      kind: 'relied_on',
      observation: `You've used this ${usage.useCount} times across ${usage.currentVersion} version${usage.currentVersion === 1 ? '' : 's'}.`,
      question: 'Anything still slowing you down when you use it?',
    };
  }

  return {
    kind: 'settling_in',
    observation: `Used ${usage.useCount} time${usage.useCount === 1 ? '' : 's'} so far.`,
    question: 'Is it doing what you need, or is something off?',
  };
}

/** "2h 15m", "45m", or "—" when nothing has been saved yet. */
export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** "today", "yesterday", "3 days ago", "12 Mar" — for last-used lines. */
export function formatLastUsed(date: Date | string | null): string {
  const days = daysSince(date);
  if (days === null) return 'never used';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const d = typeof date === 'string' ? new Date(date!) : date!;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** URL-safe token for read-only sharing. */
export function generateShareId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
