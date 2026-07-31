/**
 * Dashboard page - placeholder for Milestone 1
 */

import { requireAuth } from '@/lib/auth';
import { Button } from '@lao/ui';
import Link from 'next/link';

export const metadata = {
  title: 'Dashboard - LAO',
  description: 'Your LAO learning dashboard',
};

export default async function DashboardPage() {
  const session = await requireAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900">LAO</h1>
          <div className="flex items-center gap-4">
            <span className="text-slate-600">{session.user?.email}</span>
            <Link href="/api/auth/signout">
              <Button variant="outline">Sign Out</Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Welcome, {session.user?.name || session.user?.email}!
          </h2>

          <p className="text-slate-600 mb-8 text-lg">
            Your LAO learning dashboard is under development. Features coming soon:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-slate-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Courses</h3>
              <p className="text-slate-600">Personalized learning paths tailored to your goals</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Missions</h3>
              <p className="text-slate-600">Project-based learning by doing</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Progress</h3>
              <p className="text-slate-600">Track your learning journey</p>
            </div>
            <div className="border border-slate-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Settings</h3>
              <p className="text-slate-600">Personalize your learning experience</p>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-slate-600 text-sm">
              Milestone 1: Authentication ✓<br/>
              Milestone 2: Database Setup (in progress)<br/>
              Milestone 3: Dashboard Features (coming soon)
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
