/**
 * Collaborator tests.
 *
 * These check the promises the product makes: that the collaborator knows the
 * solution without being told twice, that it never names a vendor, that it
 * cannot rewrite someone's work without permission, and that it fails in a way
 * a person can read.
 */

import { buildContextBrief, type SolutionContext } from '../collaborator';

const base: SolutionContext = {
  name: 'Email Assistant',
  problem: 'Triaging my inbox every morning',
  problemArea: 'Email',
  content: 'Summarise each thread and say which need a reply.',
  notes: null,
  currentVersion: 1,
  useCount: 0,
  lastUsedAt: null,
  timeSavedMinutes: 30,
  totalTimeSavedMinutes: 0,
  createdAt: new Date('2026-01-01'),
  versions: [],
};

describe('the context brief', () => {
  it('tells the collaborator why the tool exists', () => {
    const brief = buildContextBrief(base);
    expect(brief).toContain('Email Assistant');
    expect(brief).toContain('Triaging my inbox every morning');
  });

  it('includes the tool exactly as it stands', () => {
    expect(buildContextBrief(base)).toContain('Summarise each thread and say which need a reply.');
  });

  it('says plainly when a tool has never been used', () => {
    expect(buildContextBrief(base)).toContain('Not used yet');
  });

  it('reports real usage rather than leaving it to be guessed', () => {
    const brief = buildContextBrief({
      ...base,
      useCount: 12,
      lastUsedAt: new Date(),
      totalTimeSavedMinutes: 360,
    });
    expect(brief).toContain('Used 12 times');
    expect(brief).toContain('6h');
  });

  it('flags a tool that is relied on but never revised', () => {
    expect(buildContextBrief(base)).toContain('never revised since it was built');
  });

  it('carries the history of how the tool changed', () => {
    const brief = buildContextBrief({
      ...base,
      currentVersion: 3,
      versions: [
        { version: 3, changeNote: 'Added tone guidance', createdAt: new Date() },
        { version: 2, changeNote: 'Made it shorter', createdAt: new Date() },
        { version: 1, changeNote: 'Created', createdAt: new Date() },
      ],
    });
    expect(brief).toContain('Added tone guidance');
    expect(brief).toContain('Made it shorter');
  });

  it("passes on the learner's own notes so they need not repeat them", () => {
    const brief = buildContextBrief({ ...base, notes: 'Struggles with long threads.' });
    expect(brief).toContain('Struggles with long threads.');
  });

  it('never mentions a vendor, a model, or prompts', () => {
    const brief = buildContextBrief({
      ...base,
      useCount: 5,
      notes: 'works well',
      versions: [{ version: 2, changeNote: 'tweaked', createdAt: new Date() }],
    }).toLowerCase();

    for (const forbidden of ['claude', 'gpt', 'openai', 'anthropic', 'gemini', 'llama', 'prompt engineering']) {
      expect(brief).not.toContain(forbidden);
    }
  });
});

describe('the product never names its infrastructure', () => {
  it('keeps vendor names out of everything the learner can reach', async () => {
    const { readFileSync, readdirSync, statSync } = await import('fs');
    const { join } = await import('path');

    const APP = join(__dirname, '..', '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry)) files.push(full);
      }
    };
    walk(APP);

    // lib/llm.ts is the single sanctioned seam to the model layer.
    const offenders: string[] = [];
    for (const file of files) {
      if (file.endsWith(join('lib', 'llm.ts'))) continue;
      const source = readFileSync(file, 'utf8').toLowerCase();
      for (const vendor of ['anthropic', 'openai', 'gemini', 'claude', 'deepseek', 'qwen', 'hermes']) {
        if (source.includes(vendor)) offenders.push(`${file.replace(APP, '')} mentions "${vendor}"`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('what the collaborator is allowed to do', () => {
  const { collaborate, CollaboratorUnavailable } = require('../collaborator');
  const { ModelRouter, ScriptedAdapter, LLMError } = require('@iriskey/llm');

  const withReply = (structured: unknown) => ({
    router: new ModelRouter({
      models: [new ScriptedAdapter({ structured, replies: ['ok'] })],
      sleep: async () => {},
    }),
    degraded: false,
  });

  const req = (intent: string) => ({
    intent: intent as any,
    solution: base,
    requestId: 'r1',
    tenantId: 't1',
    signal: new AbortController().signal,
  });

  it('offers a revision when asked to improve', async () => {
    const res = await collaborate(
      req('improve'),
      withReply({ reply: 'Shortened it.', proposedContent: 'NEW BODY', changeSummary: 'Shorter' })
    );

    expect(res.reply).toBe('Shortened it.');
    expect(res.proposedContent).toBe('NEW BODY');
    expect(res.changeSummary).toBe('Shorter');
  });

  it('cannot change the tool when only asked to explain', async () => {
    // Even if a model volunteers a rewrite, an explanation must not carry one.
    const res = await collaborate(
      req('explain'),
      withReply({ reply: 'It works like this.', proposedContent: 'SNEAKY REWRITE' })
    );

    expect(res.reply).toBe('It works like this.');
    expect(res.proposedContent).toBeUndefined();
  });

  it('falls back to prose if a model returns no structure', async () => {
    const res = await collaborate(req('improve'), withReply(undefined));
    expect(res.reply).toBe('ok');
    expect(res.proposedContent).toBeUndefined();
  });

  it('reports which model served the turn, for operations only', async () => {
    const res = await collaborate(req('improve'), withReply({ reply: 'done' }));
    expect(res.servedByModel).toBe('scripted:local');
  });

  it('explains an outage without naming a vendor', async () => {
    const failing = {
      router: new ModelRouter({
        models: [new ScriptedAdapter({ failWith: new LLMError('UNAVAILABLE', 'api.anthropic.com down') })],
        sleep: async () => {},
      }),
      degraded: false,
    };

    await expect(collaborate(req('improve'), failing)).rejects.toThrow(CollaboratorUnavailable);

    try {
      await collaborate(req('improve'), failing);
    } catch (e: any) {
      expect(e.message.toLowerCase()).not.toContain('anthropic');
      expect(e.message).toContain('unchanged');
      expect(e.retryable).toBe(true);
    }
  });

  it('tells the learner honestly when a request is refused', async () => {
    const filtered = {
      router: new ModelRouter({
        models: [new ScriptedAdapter({ failWith: new LLMError('CONTENT_FILTERED', 'blocked') })],
        sleep: async () => {},
      }),
      degraded: false,
    };

    try {
      await collaborate(req('improve'), filtered);
    } catch (e: any) {
      expect(e.message).toContain('refused');
      expect(e.retryable).toBe(false); // retrying would fail the same way
    }
  });

  it('surfaces a cancellation as not retryable', async () => {
    const controller = new AbortController();
    controller.abort();

    try {
      await collaborate(
        { ...req('improve'), signal: controller.signal },
        withReply({ reply: 'x' })
      );
    } catch (e: any) {
      expect(e.retryable).toBe(false);
    }
  });

  it('asks for structured output so a proposal can be diffed', async () => {
    const model = new ScriptedAdapter({ structured: { reply: 'ok' } });
    await collaborate(req('improve'), {
      router: new ModelRouter({ models: [model], sleep: async () => {} }),
      degraded: false,
    });

    expect(model.calls[0].responseSchema).toBeDefined();
    // The voice is set by us, once, so a provider swap cannot change the tone.
    expect(model.calls[0].system).toContain('teammate');
  });
});
