/**
 * Forgot password page
 */

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export const metadata = {
  title: 'Forgot Password - LAO',
  description: 'Reset your LAO password',
};

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900">LAO</h1>
            <p className="text-slate-600 mt-2">Reset your password</p>
          </div>

          <ForgotPasswordForm />

          <div className="mt-6 text-center">
            <p className="text-slate-600 text-sm">
              Remember your password?{' '}
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
