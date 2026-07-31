/**
 * Root layout
 */

import type { Metadata } from 'next';
import { SessionProvider } from 'next-auth/react';
import { getSession } from '@/lib/auth';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'LAO - AI Learning Operating System',
  description: 'Transform your learning journey with AI',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
