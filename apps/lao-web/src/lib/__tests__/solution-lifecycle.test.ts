/**
 * Solution lifecycle integration tests.
 *
 * These exercise the exact Prisma operations the /api/solutions routes perform,
 * against a real database, so every action in the lifecycle is verified rather
 * than assumed. Set TEST_DATABASE_URL to run them; they are skipped otherwise.
 */

import { PrismaClient } from '@prisma/client';
import { getCollaboratorPrompt, generateShareId } from '../solutions';

const url = process.env.TEST_DATABASE_URL;
const describeIfDb = url ? describe : describe.skip;

const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

describeIfDb('Solution lifecycle', () => {
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `lifecycle-${Date.now()}@test.local` },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  /** Mirrors POST /api/solutions */
  async function createSolution(name = 'Email Assistant') {
    return prisma.solution.create({
      data: {
        userId,
        name,
        problem: 'Triaging my inbox every morning',
        problemArea: 'Email',
        content: 'Summarise each thread and tell me which need a reply.',
        timeSavedMinutes: 30,
        versions: { create: { version: 1, content: 'v1 content', changeNote: 'Created' } },
      },
      include: { versions: true },
    });
  }

  it('CREATE: starts at version 1 with no usage', async () => {
    const s = await createSolution();

    expect(s.currentVersion).toBe(1);
    expect(s.useCount).toBe(0);
    expect(s.lastUsedAt).toBeNull();
    expect(s.totalTimeSavedMinutes).toBe(0);
    expect(s.status).toBe('active');
    expect(s.shareId).toBeNull();
    expect(s.versions).toHaveLength(1);
  });

  it('OPEN: loads with versions and runs, scoped to the owner', async () => {
    const s = await createSolution();

    const loaded = await prisma.solution.findUnique({
      where: { id: s.id },
      include: { versions: { orderBy: { version: 'desc' } }, runs: true },
    });

    expect(loaded?.userId).toBe(userId);
    expect(loaded?.versions[0]?.version).toBe(1);
    expect(loaded?.runs).toEqual([]);
  });

  it('RUN: increments usage, stamps lastUsedAt and accumulates time saved', async () => {
    const s = await createSolution();

    for (let i = 0; i < 3; i++) {
      await prisma.$transaction([
        prisma.solutionRun.create({
          data: { solutionId: s.id, version: s.currentVersion, timeSavedMinutes: 30 },
        }),
        prisma.solution.update({
          where: { id: s.id },
          data: {
            useCount: { increment: 1 },
            lastUsedAt: new Date(),
            totalTimeSavedMinutes: { increment: 30 },
          },
        }),
      ]);
    }

    const after = await prisma.solution.findUnique({
      where: { id: s.id },
      include: { runs: true },
    });

    expect(after?.useCount).toBe(3);
    expect(after?.lastUsedAt).not.toBeNull();
    expect(after?.totalTimeSavedMinutes).toBe(90);
    expect(after?.runs).toHaveLength(3);
    // Every run records which version was used.
    expect(after?.runs.every((r) => r.version === 1)).toBe(true);
  });

  it('IMPROVE: creates a new version and keeps the old one intact', async () => {
    const s = await createSolution();

    const updated = await prisma.solution.update({
      where: { id: s.id },
      data: {
        content: 'v2 content',
        currentVersion: 2,
        versions: { create: { version: 2, content: 'v2 content', changeNote: 'Shorter' } },
      },
      include: { versions: { orderBy: { version: 'asc' } } },
    });

    expect(updated.currentVersion).toBe(2);
    expect(updated.content).toBe('v2 content');
    expect(updated.versions).toHaveLength(2);
    expect(updated.versions[0]?.content).toBe('v1 content'); // history preserved
    expect(updated.versions[1]?.changeNote).toBe('Shorter');
  });

  it('VERSION HISTORY: version numbers are unique per solution', async () => {
    const s = await createSolution();

    await expect(
      prisma.solutionVersion.create({
        data: { solutionId: s.id, version: 1, content: 'duplicate' },
      })
    ).rejects.toThrow();
  });

  it('RESTORE: brings back old content as a new version, losing nothing', async () => {
    const s = await createSolution();

    await prisma.solution.update({
      where: { id: s.id },
      data: {
        content: 'v2 content',
        currentVersion: 2,
        versions: { create: { version: 2, content: 'v2 content' } },
      },
    });

    const v1 = await prisma.solutionVersion.findUnique({
      where: { solutionId_version: { solutionId: s.id, version: 1 } },
    });

    const restored = await prisma.solution.update({
      where: { id: s.id },
      data: {
        content: v1!.content,
        currentVersion: 3,
        versions: { create: { version: 3, content: v1!.content, changeNote: 'Restored from v1' } },
      },
      include: { versions: true },
    });

    expect(restored.content).toBe('v1 content');
    expect(restored.currentVersion).toBe(3);
    // v1 and v2 both survive the restore.
    expect(restored.versions).toHaveLength(3);
  });

  it('RENAME and NOTES: edit in place without creating a version', async () => {
    const s = await createSolution();

    const renamed = await prisma.solution.update({
      where: { id: s.id },
      data: { name: 'Inbox Triager', notes: 'Works best on long threads.' },
      include: { versions: true },
    });

    expect(renamed.name).toBe('Inbox Triager');
    expect(renamed.notes).toBe('Works best on long threads.');
    expect(renamed.currentVersion).toBe(1);
    expect(renamed.versions).toHaveLength(1);
  });

  it('DUPLICATE: copies content but not usage history or share state', async () => {
    const source = await createSolution();

    await prisma.$transaction([
      prisma.solutionRun.create({ data: { solutionId: source.id, version: 1 } }),
      prisma.solution.update({
        where: { id: source.id },
        data: { useCount: { increment: 1 }, shareId: generateShareId() },
      }),
    ]);

    const copy = await prisma.solution.create({
      data: {
        userId,
        name: `${source.name} (copy)`,
        problem: source.problem,
        problemArea: source.problemArea,
        content: source.content,
        timeSavedMinutes: source.timeSavedMinutes,
        versions: { create: { version: 1, content: source.content, changeNote: 'Copied' } },
      },
      include: { versions: true, runs: true },
    });

    expect(copy.content).toBe(source.content);
    expect(copy.useCount).toBe(0);
    expect(copy.runs).toHaveLength(0);
    expect(copy.shareId).toBeNull();
    expect(copy.currentVersion).toBe(1);
    expect(copy.id).not.toBe(source.id);
  });

  it('SHARE: publishes a unique token and can be withdrawn', async () => {
    const s = await createSolution();
    const token = generateShareId();

    const shared = await prisma.solution.update({
      where: { id: s.id },
      data: { shareId: token },
    });
    expect(shared.shareId).toBe(token);

    // The public route looks the solution up by token alone.
    const bySlug = await prisma.solution.findUnique({ where: { shareId: token } });
    expect(bySlug?.id).toBe(s.id);

    const unshared = await prisma.solution.update({
      where: { id: s.id },
      data: { shareId: null },
    });
    expect(unshared.shareId).toBeNull();
    expect(await prisma.solution.findUnique({ where: { shareId: token } })).toBeNull();
  });

  it('SHARE: two solutions cannot hold the same token', async () => {
    const a = await createSolution();
    const b = await createSolution();
    const token = generateShareId();

    await prisma.solution.update({ where: { id: a.id }, data: { shareId: token } });

    await expect(
      prisma.solution.update({ where: { id: b.id }, data: { shareId: token } })
    ).rejects.toThrow();
  });

  it('ARCHIVE: hides from the toolbox without deleting, and is reversible', async () => {
    const s = await createSolution('Archivable');

    await prisma.solution.update({ where: { id: s.id }, data: { status: 'archived' } });

    const active = await prisma.solution.findMany({ where: { userId, status: 'active' } });
    expect(active.find((x) => x.id === s.id)).toBeUndefined();

    // Still retrievable, and its history is intact.
    const still = await prisma.solution.findUnique({
      where: { id: s.id },
      include: { versions: true },
    });
    expect(still).not.toBeNull();
    expect(still?.versions.length).toBeGreaterThan(0);

    await prisma.solution.update({ where: { id: s.id }, data: { status: 'active' } });
    const restored = await prisma.solution.findUnique({ where: { id: s.id } });
    expect(restored?.status).toBe('active');
  });

  it('DELETE: removes the solution and cascades to versions and runs', async () => {
    const s = await createSolution();
    await prisma.solutionRun.create({ data: { solutionId: s.id, version: 1 } });

    await prisma.solution.delete({ where: { id: s.id } });

    expect(await prisma.solution.findUnique({ where: { id: s.id } })).toBeNull();
    expect(await prisma.solutionVersion.count({ where: { solutionId: s.id } })).toBe(0);
    expect(await prisma.solutionRun.count({ where: { solutionId: s.id } })).toBe(0);
  });

  it('SORTING: most recently used first, never-used last', async () => {
    const other = await prisma.user.create({
      data: { email: `sorting-${Date.now()}@test.local` },
    });

    const make = async (name: string, lastUsedAt: Date | null) =>
      prisma.solution.create({
        data: {
          userId: other.id,
          name,
          problem: 'p',
          content: 'c',
          lastUsedAt,
          useCount: lastUsedAt ? 1 : 0,
        },
      });

    await make('never-used', null);
    await make('older', new Date('2024-01-01'));
    await make('newest', new Date('2024-06-01'));

    const listed = await prisma.solution.findMany({
      where: { userId: other.id, status: 'active' },
      orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    });

    expect(listed.map((s) => s.name)).toEqual(['newest', 'older', 'never-used']);

    await prisma.user.delete({ where: { id: other.id } });
  });

  it('OWNERSHIP: another user cannot reach this solution', async () => {
    const s = await createSolution();
    const intruder = await prisma.user.create({
      data: { email: `intruder-${Date.now()}@test.local` },
    });

    // Routes scope every lookup by userId, so this must find nothing.
    const found = await prisma.solution.findFirst({
      where: { id: s.id, userId: intruder.id },
    });
    expect(found).toBeNull();

    await prisma.user.delete({ where: { id: intruder.id } });
  });

  it('CASCADE: deleting the owner removes their solutions', async () => {
    const doomed = await prisma.user.create({
      data: { email: `doomed-${Date.now()}@test.local` },
    });
    const s = await prisma.solution.create({
      data: { userId: doomed.id, name: 'Temp', problem: 'p', content: 'c' },
    });

    await prisma.user.delete({ where: { id: doomed.id } });

    expect(await prisma.solution.findUnique({ where: { id: s.id } })).toBeNull();
  });
});

describe('Collaborator prompts reflect real usage', () => {
  const base = { createdAt: new Date(), totalTimeSavedMinutes: 0 };

  it('asks about workflow fit when a solution is built but unused', () => {
    const p = getCollaboratorPrompt({
      ...base,
      createdAt: new Date(Date.now() - 7 * 86400000),
      useCount: 0,
      lastUsedAt: null,
      currentVersion: 1,
    });
    expect(p.kind).toBe('unused');
  });

  it('offers to improve a heavily used solution still on v1', () => {
    const p = getCollaboratorPrompt({
      ...base,
      useCount: 12,
      lastUsedAt: new Date(),
      currentVersion: 1,
    });
    expect(p.kind).toBe('stale_version');
    expect(p.observation).toContain('12 times');
  });
});

describeIfDb('Collaborator persistence', () => {
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `collab-${Date.now()}@test.local` },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  async function withConversation() {
    const solution = await prisma.solution.create({
      data: {
        userId,
        name: 'Email Assistant',
        problem: 'inbox triage',
        content: 'v1 content',
        versions: { create: { version: 1, content: 'v1 content', changeNote: 'Created' } },
      },
    });
    const conversation = await prisma.solutionConversation.create({
      data: { solutionId: solution.id },
    });
    return { solution, conversation };
  }

  it('keeps one thread per solution, so it outlives a visit', async () => {
    const { solution } = await withConversation();

    // A second visit reuses the same thread rather than starting over.
    const again = await prisma.solutionConversation.upsert({
      where: { solutionId: solution.id },
      update: {},
      create: { solutionId: solution.id },
    });

    const count = await prisma.solutionConversation.count({
      where: { solutionId: solution.id },
    });
    expect(count).toBe(1);
    expect(again.solutionId).toBe(solution.id);
  });

  it('records both sides of the conversation in order', async () => {
    const { conversation } = await withConversation();

    await prisma.solutionMessage.create({
      data: { conversationId: conversation.id, role: 'learner', content: 'Make this simpler', intent: 'improve' },
    });
    await prisma.solutionMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'collaborator',
        content: 'Shortened it.',
        proposedContent: 'v2 content',
        servedByModel: 'scripted:local',
      },
    });

    const messages = await prisma.solutionMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(messages.map((m) => m.role)).toEqual(['learner', 'collaborator']);
    expect(messages[1]?.proposedContent).toBe('v2 content');
    expect(messages[1]?.acceptedVersion).toBeNull();
  });

  it('a proposal changes nothing until the learner accepts', async () => {
    const { solution, conversation } = await withConversation();

    await prisma.solutionMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'collaborator',
        content: 'Try this.',
        proposedContent: 'PROPOSED BUT NOT ACCEPTED',
      },
    });

    const unchanged = await prisma.solution.findUnique({ where: { id: solution.id } });
    expect(unchanged?.content).toBe('v1 content');
    expect(unchanged?.currentVersion).toBe(1);
  });

  it('accepting a proposal creates a version and marks it accepted', async () => {
    const { solution, conversation } = await withConversation();

    const message = await prisma.solutionMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'collaborator',
        content: 'Shortened it.',
        proposedContent: 'ACCEPTED CONTENT',
      },
    });

    // Mirrors the accept route.
    const updated = await prisma.$transaction(async (tx) => {
      const latest = await tx.solutionVersion.findFirst({
        where: { solutionId: solution.id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const next = (latest?.version ?? solution.currentVersion) + 1;

      const s = await tx.solution.update({
        where: { id: solution.id },
        data: {
          content: 'ACCEPTED CONTENT',
          currentVersion: next,
          versions: {
            create: { version: next, content: 'ACCEPTED CONTENT', changeNote: 'Improved with the collaborator' },
          },
        },
        include: { versions: true },
      });
      await tx.solutionMessage.update({
        where: { id: message.id },
        data: { acceptedVersion: next },
      });
      return s;
    });

    expect(updated.content).toBe('ACCEPTED CONTENT');
    expect(updated.currentVersion).toBe(2);
    // The original is still there — improvement never destroys history.
    expect(updated.versions.find((v) => v.version === 1)?.content).toBe('v1 content');

    const marked = await prisma.solutionMessage.findUnique({ where: { id: message.id } });
    expect(marked?.acceptedVersion).toBe(2);
  });

  it('deleting a solution takes its conversation with it', async () => {
    const { solution, conversation } = await withConversation();
    await prisma.solutionMessage.create({
      data: { conversationId: conversation.id, role: 'learner', content: 'hi' },
    });

    await prisma.solution.delete({ where: { id: solution.id } });

    expect(await prisma.solutionConversation.count({ where: { solutionId: solution.id } })).toBe(0);
    expect(await prisma.solutionMessage.count({ where: { conversationId: conversation.id } })).toBe(0);
  });

  it('counts opens, which is one of the four founder numbers', async () => {
    const { solution } = await withConversation();

    for (let i = 0; i < 3; i++) {
      await prisma.solution.update({
        where: { id: solution.id },
        data: { openCount: { increment: 1 }, lastOpenedAt: new Date() },
      });
    }

    const after = await prisma.solution.findUnique({ where: { id: solution.id } });
    expect(after?.openCount).toBe(3);
    expect(after?.lastOpenedAt).not.toBeNull();
  });
});
