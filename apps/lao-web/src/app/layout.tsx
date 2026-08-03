/**
 * Root layout
 */

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import { getSession } from '@/lib/auth';
import '../styles/globals.css';

// Self-hosted by Next, so there is no third-party request and no layout shift.
// See /brand/typography/typography.md.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'LAO Academy',
  description: 'Solve real problems with AI, and keep the solutions.',
};

// Declared rather than left to the framework default. Without it a phone
// renders the page at desktop width and scales it down, which makes every
// responsive breakpoint below irrelevant. `maximumScale` is deliberately
// unset: capping zoom locks out anyone who needs to enlarge text.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      {/* White is the product surface — see /brand/brand-guidelines.md §4 */}
      <body className="bg-surface text-ink font-sans antialiased">
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
