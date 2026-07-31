/**
 * LAO Profile API
 * Get and update user profile
 */

import { PrismaClient } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';

const prisma = new PrismaClient();

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
  timezone: z.string().optional(),
  language: z.string().length(2).optional(),
});

/**
 * GET /api/profile
 * Get user's profile
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [user, profile] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          emailVerified: true,
          createdAt: true,
        },
      }),
      prisma.profile.findUnique({
        where: { userId },
      }),
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user, profile });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profile
 * Update user's profile
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, ...profileUpdates } = validation.data;

    const [updatedUser, updatedProfile] = await Promise.all([
      name
        ? prisma.user.update({
            where: { id: userId },
            data: { name },
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              emailVerified: true,
            },
          })
        : prisma.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              emailVerified: true,
            },
          }),
      prisma.profile.update({
        where: { userId },
        data: profileUpdates,
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        userId,
        productId: 'lao',
        action: 'profile_updated',
        resource: 'profile',
        details: { fields: Object.keys(validation.data) },
      },
    });

    return NextResponse.json({ user: updatedUser, profile: updatedProfile });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
