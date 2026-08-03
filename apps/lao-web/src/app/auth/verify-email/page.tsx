/**
 * Verify email page
 */

import { VerifyEmailForm } from '@/components/auth/verify-email-form';

export const metadata = {
  title: 'Verify Email - LAO',
  description: 'Verify your LAO account email',
};

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900">LAO</h1>
            <p className="text-slate-600 mt-2">Verify your email</p>
          </div>

          <VerifyEmailForm email={searchParams.email} />
        </div>
      </div>
    </div>
  );
}
