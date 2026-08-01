import Link from 'next/link';

export const metadata = { title: 'Privacy — LAO Academy' };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface">
      <main className="max-w-prose mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-ink-muted hover:text-ink">
          LAO Academy
        </Link>

        <h1 className="text-[32px] leading-tight font-semibold text-ink mt-8 mb-3">Privacy</h1>
        <p className="text-base leading-relaxed text-ink-muted mb-10">
          Last updated 1 August 2026. Written to be read, not to be survived.
        </p>

        <section className="space-y-4 mb-10">
          <h2 className="text-2xl font-semibold text-ink">What we hold</h2>
          <p className="text-base leading-relaxed text-ink-body">
            Your email address and name. The solutions you build — including every
            version you save, notes you write, and each time you record using one.
            The conversations you have with the collaborator about those solutions.
          </p>
          <p className="text-base leading-relaxed text-ink-body">
            We do not use tracking pixels, advertising networks, or third-party
            analytics.
          </p>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-2xl font-semibold text-ink">The collaborator</h2>
          <p className="text-base leading-relaxed text-ink-body">
            When you ask the collaborator to help with a solution, the content of
            that solution and your recent messages about it are sent to a language
            model provider so it can reply. Which provider varies and is an
            operational detail.
          </p>
          <p className="text-base leading-relaxed text-ink-body">
            Those conversations are stored against the solution so the collaborator
            remembers it next time, and so you do not have to explain yourself
            twice. Deleting a solution deletes its conversation.
          </p>
          <p className="text-base leading-relaxed text-ink-body">
            We do not log the text of what is sent or returned. We keep only which
            model answered, how long it took, and whether it worked.
          </p>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-2xl font-semibold text-ink">Your solutions are yours</h2>
          <p className="text-base leading-relaxed text-ink-body">
            You can download everything we hold, in full, at any time, from{' '}
            <Link href="/settings" className="text-brand-blue underline">
              settings
            </Link>
            . You can delete your account from the same page. Deletion removes your
            solutions, versions, recorded uses and conversations. It is immediate
            and cannot be undone.
          </p>
          <p className="text-base leading-relaxed text-ink-body">
            A solution is private unless you create a share link. If you do, anyone
            with that link can read that solution — and nothing else. You can
            withdraw a share link at any time.
          </p>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-2xl font-semibold text-ink">How long we keep it</h2>
          <p className="text-base leading-relaxed text-ink-body">
            For as long as your account exists. When you delete it, the data goes
            with it. Backups are retained for 30 days and then expire.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-ink">Getting in touch</h2>
          <p className="text-base leading-relaxed text-ink-body">
            For anything about your data, including access, correction or erasure,
            email <span className="text-ink">privacy@lao.academy</span>. During
            private beta we reply within a few days.
          </p>
        </section>
      </main>
    </div>
  );
}
