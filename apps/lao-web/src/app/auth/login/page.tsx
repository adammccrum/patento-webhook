/**
 * Login page
 */

import { LoginForm } from '@/components/auth/login-form';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Login - LAO',
  description: 'Sign in to your LAO account',
};

export default async function LoginPage() {
  const session = await getSession();

  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900">LAO</h1>
            <p className="text-slate-600 mt-2">AI Learning Operating System</p>
          </div>

          <LoginForm />

          <div className="mt-6 text-center">
            <p className="text-slate-600 text-sm">
              Don't have an account?{' '}
              <a href="/auth/register" className="text-primary hover:underline font-medium">
                Sign up
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
