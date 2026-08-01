/**
 * Landing page
 */

import { getSession } from '@/lib/auth';
import { Button } from '@lao/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Wrench, Target, TrendingUp, Rocket, ShieldCheck, Globe } from 'lucide-react';

export default async function HomePage() {
  const session = await getSession();

  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Navigation */}
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900">LAO</h1>
          <div className="flex gap-4">
            <Link href="/auth/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/register">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-slate-900 mb-6">
            AI Learning Operating System
          </h2>
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            Transform your learning journey with personalized AI. From where you are today to
            where you want to be—intelligently guided by AI.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth/register">
              <Button size="lg">Get Started</Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" size="lg">
                Learn More
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <Wrench size={28} strokeWidth={1.5} className="text-brand-blue mb-4" aria-hidden />
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Invisible AI</h3>
            <p className="text-slate-600">
              The AI works behind the scenes. You never need to choose between providers—we
              select the best one for you.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <Target size={28} strokeWidth={1.5} className="text-brand-blue mb-4" aria-hidden />
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Personalized</h3>
            <p className="text-slate-600">
              No two dashboards are the same. Every learning path is uniquely tailored to your
              goals and pace.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <TrendingUp size={28} strokeWidth={1.5} className="text-brand-blue mb-4" aria-hidden />
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Measurable Progress</h3>
            <p className="text-slate-600">
              Track every interaction. Your progress is always visible, and insights drive
              smarter recommendations.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <Rocket size={28} strokeWidth={1.5} className="text-brand-blue mb-4" aria-hidden />
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Learning by Doing</h3>
            <p className="text-slate-600">
              Build real projects before diving into theory. Learn through hands-on missions
              and challenges.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <ShieldCheck size={28} strokeWidth={1.5} className="text-brand-blue mb-4" aria-hidden />
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Secure & Private</h3>
            <p className="text-slate-600">
              Your data is encrypted, audited, and completely under your control. GDPR and
              OWASP compliant.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <Globe size={28} strokeWidth={1.5} className="text-brand-blue mb-4" aria-hidden />
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Scalable</h3>
            <p className="text-slate-600">
              Built for millions of users from day one. Consistent performance as you grow.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-slate-900 text-white rounded-lg shadow-lg p-12 mt-20 text-center">
          <h3 className="text-3xl font-bold mb-4">Ready to transform your learning?</h3>
          <p className="text-slate-300 mb-8">Join thousands of learners on their journey to mastery.</p>
          <Link href="/auth/register">
            <Button size="lg" variant="secondary">
              Start Your Journey
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-slate-600 text-sm">
          <p>© 2026 LAO Academy</p>
        </div>
      </footer>
    </div>
  );
}
