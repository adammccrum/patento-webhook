/**
 * IrisKey Platform Authentication Configuration
 * Multi-product, provider-agnostic authentication system
 * Supports Email/Password, Google OAuth, GitHub OAuth, and extensible custom providers
 */

import { PrismaAdapter } from '@auth/prisma-adapter';
import type { PrismaClient } from '@prisma/client';
import { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { verifyPassword } from './crypto';

/**
 * This config writes `id` and `provider` onto the session user. NextAuth's
 * stock Session type doesn't declare them, so we augment it here. (The JWT
 * type already permits arbitrary keys, so it needs no augmentation.)
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      provider?: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

export interface AuthConfigOptions {
  prisma: PrismaClient;
  productId: string;
  pages?: {
    signIn?: string;
    error?: string;
  };
}

/**
 * Create authentication configuration
 * Products instantiate this with their Prisma client and product ID
 * No product-specific logic in this function
 */
export function createAuthConfig(options: AuthConfigOptions): NextAuthConfig {
  const { prisma, productId, pages = {} } = options;

  return {
    adapter: PrismaAdapter(prisma),
    providers: [
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
      GitHub({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
      Credentials({
        id: 'credentials',
        name: 'Credentials',
        credentials: {
          email: { label: 'Email', type: 'email' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          if (!credentials?.email || !credentials?.password) {
            return null;
          }

          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          });

          if (!user || !user.password) {
            return null;
          }

          const isValid = await verifyPassword(
            credentials.password as string,
            user.password
          );

          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        },
      }),
    ],
    pages: {
      signIn: pages.signIn || '/auth/login',
      error: pages.error || '/auth/error',
    },
    callbacks: {
      async jwt({ token, user, account }) {
        if (user) {
          token.id = user.id;
          token.productId = productId;
        }
        if (account) {
          token.provider = account.provider;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          session.user.id = token.id as string;
          session.user.provider = token.provider as string;
        }
        return session;
      },
    },
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    jwt: {
      maxAge: 30 * 24 * 60 * 60,
    },
    events: {
      async signIn({ user, account }) {
        if (user?.id) {
          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: 'user_signed_in',
              resource: 'auth',
              details: {
                provider: account?.provider || 'credentials',
                productId,
              },
            },
          });
        }
      },
      // The payload differs by session strategy: JWT sessions carry `token`,
      // database sessions carry `session`. We use JWT, so narrow to that.
      async signOut(message) {
        const token = 'token' in message ? message.token : null;
        if (token?.sub) {
          await prisma.auditLog.create({
            data: {
              userId: token.sub,
              action: 'user_signed_out',
              resource: 'auth',
              details: { productId },
            },
          });
        }
      },
    },
    trustHost: true,
  };
}
