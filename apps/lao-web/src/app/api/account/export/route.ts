import { withCapability } from '@/lib/authorization';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Reads the session from request headers, so it can never be statically rendered.
export const dynamic = 'force-dynamic';

/**
 * Everything we hold about this learner, in one file (GDPR Art. 20).
 *
 * We tell learners their solutions are theirs. This is what makes that true:
 * the full content of every version, every recorded use, and every word of
 * every conversation with the collaborator — in a format they can read without
 * us.
 */
export const GET = withCapability(
  'account.read',
  async (_request: Request, { principal }: any) => {
    try {
      const userId = principal.userId;

      const [user, profile, settings, credits, solutions, enrollments] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, name: true, createdAt: true, emailVerified: true },
        }),
        prisma.profile.findUnique({
          where: { userId },
          select: { bio: true, timezone: true, language: true, onboardingCompleted: true },
        }),
        prisma.settings.findUnique({
          where: { userId },
          select: { emailNotifications: true, twoFactorEnabled: true, publicProfile: true },
        }),
        prisma.credits.findUnique({
          where: { userId },
          select: { balance: true, spent: true, monthlyReset: true },
        }),
        prisma.solution.findMany({
          where: { userId },
          include: {
            versions: { orderBy: { version: 'asc' } },
            runs: { orderBy: { ranAt: 'asc' } },
            conversation: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.courseEnrollment.findMany({
          where: { userId },
          select: {
            courseId: true,
            missionsCompleted: true,
            enrolledAt: true,
            completedAt: true,
          },
        }),
      ]);

      if (!user) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      const payload = {
        exportedAt: new Date().toISOString(),
        // Explains the file to whoever opens it, including a future regulator.
        about:
          'Everything LAO Academy holds about this account. Solutions include the ' +
          'full text of every version you saved, every time you recorded using them, ' +
          'and every message exchanged with the collaborator.',
        account: user,
        profile,
        settings,
        credits,
        courseEnrollments: enrollments,
        solutions: solutions.map((s) => ({
          name: s.name,
          problem: s.problem,
          problemArea: s.problemArea,
          content: s.content,
          notes: s.notes,
          currentVersion: s.currentVersion,
          useCount: s.useCount,
          lastUsedAt: s.lastUsedAt,
          totalTimeSavedMinutes: s.totalTimeSavedMinutes,
          status: s.status,
          createdAt: s.createdAt,
          // A share link is data about them too.
          sharedPublicly: Boolean(s.shareId),
          versions: s.versions.map((v) => ({
            version: v.version,
            content: v.content,
            changeNote: v.changeNote,
            createdAt: v.createdAt,
          })),
          uses: s.runs.map((r) => ({
            version: r.version,
            timeSavedMinutes: r.timeSavedMinutes,
            note: r.note,
            ranAt: r.ranAt,
          })),
          conversation:
            s.conversation?.messages.map((m) => ({
              role: m.role,
              content: m.content,
              proposedContent: m.proposedContent,
              acceptedVersion: m.acceptedVersion,
              createdAt: m.createdAt,
            })) ?? [],
        })),
      };

      const filename = `lao-academy-export-${new Date().toISOString().slice(0, 10)}.json`;

      return new NextResponse(JSON.stringify(payload, null, 2), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'content-disposition': `attachment; filename="${filename}"`,
          // Never cached — it is the learner's whole record.
          'cache-control': 'no-store',
        },
      });
    } catch (error) {
      console.error('Error exporting account:', error);
      return NextResponse.json({ error: 'Failed to export your data' }, { status: 500 });
    }
  }
);
