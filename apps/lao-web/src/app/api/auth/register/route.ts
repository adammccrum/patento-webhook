/**
 * LAO User registration endpoint
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword, generateVerificationToken } from '@iriskey/auth';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const prisma = new PrismaClient();
const PRODUCT_ID = 'lao';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * POST /api/auth/register
 * Register a new user on LAO
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = registerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, email, password } = validation.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        profile: {
          create: {},
        },
        credits: {
          create: {
            balance: 1000,
            monthlyReset: 1000,
          },
        },
        settings: {
          create: {},
        },
      },
    });

    const verificationToken = generateVerificationToken();

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: verificationToken,
        type: 'email-verify',
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        productId: PRODUCT_ID,
        action: 'user_registered',
        resource: 'auth',
        details: { email },
      },
    });

    return NextResponse.json(
      {
        message: 'Registration successful. Please verify your email.',
        userId: user.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
