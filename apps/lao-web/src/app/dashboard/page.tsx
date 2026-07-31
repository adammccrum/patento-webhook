'use client';

import { useEffect, useState } from 'react';
import { Button } from '@lao/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const response = await fetch('/api/dashboard');
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/login');
            return;
          }
          throw new Error('Failed to fetch dashboard');
        }
        const data = await response.json();
        setDashboardData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [router]);

  async function handleSignOut() {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
      router.push('/auth/login');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-red-600">{error || 'Failed to load dashboard'}</div>
      </div>
    );
  }

  const { user, profile, credits, settings, recentActivity, stats } = dashboardData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900">LAO</h1>
          <div className="flex items-center gap-4">
            <span className="text-slate-600">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            Welcome, {user.name || user.email}!
          </h2>
          <p className="text-slate-600">
            {stats.isOnboarded ? 'Onboarding completed' : 'Let\'s get you started'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Account Age</h3>
            <p className="text-3xl font-bold text-slate-900">{stats.accountAge}</p>
            <p className="text-sm text-slate-500">days</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Credits Remaining</h3>
            <p className="text-3xl font-bold text-slate-900">
              {Math.max(0, (credits?.monthlyReset || 0) - (credits?.spent || 0))}
            </p>
            <div className="mt-3 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all"
                style={{
                  width: `${100 - ((credits?.spent || 0) / (credits?.monthlyReset || 1) * 100)}%`,
                }}
              />
            </div>
            <p className="text-sm text-slate-500 mt-2">
              {credits?.spent || 0} / {credits?.monthlyReset || 0} used
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Onboarding Status</h3>
            <p className="text-3xl font-bold text-slate-900">
              {stats.isOnboarded ? '✓' : '○'}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              {stats.isOnboarded ? 'Completed' : 'Start now'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {recentActivity && recentActivity.length > 0 ? (
                  recentActivity.map((activity: any) => (
                    <div
                      key={activity.id}
                      className="flex items-center justify-between py-2 border-b border-slate-100 last:border-b-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{activity.action}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(activity.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                        {activity.resource}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-sm">No activity yet</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Links</h3>
              <div className="space-y-2">
                <Link href="/profile">
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-slate-700 text-sm font-medium transition">
                    → Profile
                  </button>
                </Link>
                <Link href="/settings">
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-slate-700 text-sm font-medium transition">
                    → Settings
                  </button>
                </Link>
                <Link href="/credits">
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-slate-700 text-sm font-medium transition">
                    → Credits
                  </button>
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Status</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                  <span className="text-slate-600">Email Verified</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-slate-600">2FA: {settings?.twoFactorEnabled ? 'On' : 'Off'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-slate-400"></span>
                  <span className="text-slate-600">Notifications: {settings?.emailNotifications ? 'On' : 'Off'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
