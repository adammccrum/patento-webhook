import Link from 'next/link';

export const metadata = { title: 'Cookies — LAO Academy' };

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-surface">
      <main className="max-w-prose mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-ink-muted hover:text-ink">
          LAO Academy
        </Link>

        <h1 className="text-[32px] leading-tight font-semibold text-ink mt-8 mb-3">Cookies</h1>
        <p className="text-base leading-relaxed text-ink-muted mb-10">
          We use three, all strictly necessary. There is no consent banner because
          there is nothing to consent to.
        </p>

        <div className="space-y-6">
          {[
            {
              name: 'authjs.session-token',
              why: 'Keeps you signed in. Without it every page would ask for your password.',
              life: 'Until you sign out, or 30 days.',
            },
            {
              name: 'authjs.csrf-token',
              why: 'Stops another site submitting forms as you.',
              life: 'The browser session.',
            },
            {
              name: 'authjs.callback-url',
              why: 'Returns you to the page you were on after signing in.',
              life: 'The browser session.',
            },
          ].map((c) => (
            <div key={c.name} className="border border-hairline rounded-card p-5">
              <p className="font-mono text-sm text-ink mb-2">{c.name}</p>
              <p className="text-base leading-relaxed text-ink-body">{c.why}</p>
              <p className="text-sm text-ink-muted mt-2">Kept for: {c.life}</p>
            </div>
          ))}
        </div>

        <p className="text-base leading-relaxed text-ink-body mt-10">
          No advertising cookies. No third-party analytics. No cross-site tracking.
          Blocking these three will stop you signing in.
        </p>
      </main>
    </div>
  );
}
