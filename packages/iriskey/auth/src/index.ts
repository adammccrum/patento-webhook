/**
 * IrisKey Platform Authentication Module
 * Multi-product authentication system with pluggable providers
 */

export { createAuthConfig, type AuthConfigOptions } from './config';
export { hashPassword, verifyPassword, generateVerificationToken } from './crypto';
export type { NextAuthConfig } from 'next-auth';
