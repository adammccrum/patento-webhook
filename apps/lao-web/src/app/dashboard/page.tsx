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

  const { user, profile, credits, settings, recentActivity, stats, portfolio = [], learnerState = {} } = dashboardData;

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
        {/* Workbench Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">
            Good morning{learnerState.problemsSolved > 0 ? '.' : '. What are we solving today?'}
          </h2>
        </div>

        {/* Current Metrics - What's Real */}
        {learnerState.problemsSolved > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
              <p className="text-sm text-slate-600 font-medium mb-1">Problems solved</p>
              <p className="text-3xl font-bold text-slate-900">{learnerState.problemsSolved}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
              <p className="text-sm text-slate-600 font-medium mb-1">Solutions in daily use</p>
              <p className="text-3xl font-bold text-slate-900">{portfolio?.length || 0}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 border border-slate-200">
              <p className="text-sm text-slate-600 font-medium mb-1">Time saved each week</p>
              <p className="text-3xl font-bold text-slate-900">
                {learnerState.problemsSolved > 0 ? `${Math.floor(learnerState.problemsSolved * 30 / 60)}h ${(learnerState.problemsSolved * 30) % 60}m` : '—'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">Your Toolbox</h3>
              <div className="space-y-3">
                {portfolio && portfolio.length > 0 ? (
                  portfolio.map((item: any) => (
                    <div
                      key={item.id}
                      className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition"
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 text-sm break-words">{item.problemSolved}</p>
                          <p className="text-xs text-slate-600 mt-1">{item.problemArea || 'Solution'}</p>
                        </div>
                        <button className="px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded whitespace-nowrap">
                          Open
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-600">Saves ~{Math.ceil((item.impact?.match(/\d+/)?.[0] || 30) / 60)} hours/week</p>
                        <button className="px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded">
                          Improve
                        </button>
                      </div>
                    </div>
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
                {portfolio && portfolio.length > 0 ? (
                  <>
                    <p className="text-sm text-slate-600">You've solved {learnerState.problemsSolved}. What's your next problem?</p>
                    <Link href="/course/1">
                      <button className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium">
                        Solve Another
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
