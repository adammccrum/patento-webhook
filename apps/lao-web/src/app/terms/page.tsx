import Link from 'next/link';

export const metadata = { title: 'Terms — LAO Academy' };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface">
      <main className="max-w-prose mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-ink-muted hover:text-ink">
          LAO Academy
        </Link>

        <h1 className="text-[32px] leading-tight font-semibold text-ink mt-8 mb-3">Terms</h1>
        <p className="text-base leading-relaxed text-ink-muted mb-10">
          Last updated 1 August 2026. LAO Academy is in private beta.
        </p>

        <section className="space-y-4 mb-10">
          <h2 className="text-2xl font-semibold text-ink">What you own</h2>
          <p className="text-base leading-relaxed text-ink-body">
            The solutions you build are yours. We claim no ownership of them and no
            licence to use them beyond running the service for you. You can export
            or delete them whenever you like.
          </p>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-2xl font-semibold text-ink">What we ask</h2>
          <p className="text-base leading-relaxed text-ink-body">
            Use it for your own work. Do not use it to build anything unlawful, or
            to attempt to disrupt the service for others. One account per person.
          </p>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-2xl font-semibold text-ink">What we can promise</h2>
          <p className="text-base leading-relaxed text-ink-body">
            During private beta, not much. The service may be interrupted, and
            features may change or be removed. Keep your own copy of anything you
            depend on — the export in{' '}
            <Link href="/settings" className="text-brand-blue underline">
              settings
            </Link>{' '}
            exists for exactly that.
          </p>
          <p className="text-base leading-relaxed text-ink-body">
            The collaborator makes suggestions. It is sometimes wrong. Read what it
            proposes before you accept it — nothing it suggests is saved unless you
            choose to save it.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-ink">Ending it</h2>
          <p className="text-base leading-relaxed text-ink-body">
            You can delete your account at any time from settings. We may close an
            account that breaks these terms, and will say why.
          </p>
        </section>
      </main>
    </div>
  );
}
