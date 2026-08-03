/**
 * Reset password page — where the link in the reset email lands.
 */

import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata = {
  title: 'Choose a new password - LAO',
  description: 'Set a new password for your LAO account',
};

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900">LAO</h1>
            <p className="text-slate-600 mt-2">Choose a new password</p>
          </div>

          {/* The form reads the token from the query string, so it must be
              inside a Suspense boundary or the whole route opts out of static
              rendering at build time. */}
          <Suspense fallback={<p className="text-slate-600 text-sm text-center">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>

          <div className="mt-6 text-center">
            <p className="text-slate-600 text-sm">
              Remembered it?{' '}
              <a href="/auth/login" className="text-primary hover:underline font-medium">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
