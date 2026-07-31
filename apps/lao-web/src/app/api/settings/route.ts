/**
 * LAO Settings API
 * Get and update user settings
 */

import { PrismaClient } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';

const prisma = new PrismaClient();

const updateSettingsSchema = z.object({
  twoFactorEnabled: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  darkMode: z.boolean().optional(),
  emailOnLogin: z.boolean().optional(),
  emailOnSecurityAlert: z.boolean().optional(),
});

/**
 * GET /api/settings
 * Get user's settings
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.settings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Settings fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings
 * Update user's settings
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const updatedSettings = await prisma.settings.update({
      where: { userId },
      data: validation.data,
    });

    await prisma.auditLog.create({
      data: {
        userId,
        productId: 'lao',
        action: 'settings_updated',
        resource: 'settings',
        details: { fields: Object.keys(validation.data) },
      },
    });

    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error('Settings update error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
