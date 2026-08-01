'use client';

import { useEffect, useState } from 'react';
import { Button } from '@lao/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatLastUsed, formatMinutes } from '@/lib/solutions';

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

  const {
    user,
    profile,
    credits,
    settings,
    recentActivity,
    stats,
    portfolio = [],
    learnerState = {},
    solutions = [],
    toolbox = { total: 0, inUse: 0, weeklyTimeSaved: 0 },
  } = dashboardData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900">LAO</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 text-sm transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Workbench Header — the same question every time. That's the habit. */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">What are we solving today?</h2>
        </div>

        {/* Current Metrics - measured from real usage, not completions */}
        {toolbox.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
              <p className="text-sm text-slate-600 font-medium mb-1">Problems solved</p>
              <p className="text-3xl font-bold text-slate-900">{toolbox.total}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
              <p className="text-sm text-slate-600 font-medium mb-1">Solutions in use</p>
              <p className="text-3xl font-bold text-slate-900">{toolbox.inUse}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
              <p className="text-sm text-slate-600 font-medium mb-1">Time saved each week</p>
              <p className="text-3xl font-bold text-slate-900">
                {formatMinutes(toolbox.weeklyTimeSaved)}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">Your Toolbox</h3>
                {solutions.length > 0 && (
                  <Link href="/solutions" className="text-sm text-slate-600 hover:text-slate-900">
                    All solutions
                  </Link>
                )}
              </div>
              <div className="space-y-3">
                {solutions.length > 0 ? (
                  solutions.slice(0, 6).map((item: any) => (
                    <Link key={item.id} href={`/solutions/${item.id}`}>
                      <div className="p-4 border border-slate-200 rounded-lg hover:border-slate-400 transition cursor-pointer">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm">{item.name}</p>
                            <p className="text-xs text-slate-600 mt-1 truncate">{item.problem}</p>
                          </div>
                          <span className="text-xs font-medium text-blue-600 whitespace-nowrap">Open</span>
                        </div>
                        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                          <span>
                            {item.useCount === 0
                              ? 'Not used yet'
                              : `Used ${item.useCount} time${item.useCount === 1 ? '' : 's'}`}
                          </span>
                          <span>Last used {formatLastUsed(item.lastUsedAt)}</span>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <p className="text-slate-700 font-medium mb-4">Build your first solution</p>
                    <Link href="/course/1">
                      <button className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium">
                        Start
                      </button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">What's Next</h3>
              <div className="space-y-3">
                {solutions.length > 0 ? (
                  <>
                    <p className="text-sm text-slate-600">What else is costing you time?</p>
                    <Link href="/course/1">
                      <button className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium">
                        Solve Another
                      </button>
                    </Link>
                    <Link href="/solutions/new">
                      <button className="w-full px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium">
                        Add Existing Solution
                      </button>
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-600">Find one problem that wastes your time. Solve it.</p>
                    <Link href="/course/1">
                      <button className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium">
                        Start
                      </button>
                    </Link>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Settings</h3>
              <div className="space-y-2">
                <Link href="/profile">
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-slate-700 text-sm transition">
                    Profile
                  </button>
                </Link>
                <Link href="/settings">
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-slate-700 text-sm transition">
                    Settings
                  </button>
                </Link>
                <Link href="/settings">
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-slate-700 text-sm transition">
                    Billing
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
