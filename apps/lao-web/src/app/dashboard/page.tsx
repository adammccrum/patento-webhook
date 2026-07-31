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
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome, {user.name || user.email}!
            </h2>
            <p className="text-slate-600">
              {stats.isOnboarded ? 'Onboarding completed' : 'Let\'s get you started'}
            </p>
          </div>
          <Link href="/discover">
            <button className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition">
              + Start New Discovery
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Things You've Built</h3>
            <p className="text-3xl font-bold text-slate-900">{learnerState.problemsSolved || 0}</p>
            <p className="text-sm text-slate-500">AI solutions in use</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Your Confidence</h3>
            <p className="text-3xl font-bold text-slate-900">
              {Math.round((learnerState.overallConfidence || 0.5) * 100)}%
            </p>
            <div className="mt-3 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-green-500 h-full transition-all"
                style={{
                  width: `${(learnerState.overallConfidence || 0.5) * 100}%`,
                }}
              />
            </div>
            <p className="text-sm text-slate-500 mt-2">
              In building solutions
            </p>
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900">What I've Built</h3>
                <span className="text-sm text-slate-500">{portfolio?.length || 0} creation{portfolio?.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-4">
                {portfolio && portfolio.length > 0 ? (
                  portfolio.map((item: any) => (
                    <div
                      key={item.id}
                      className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{item.problemSolved}</p>
                          <p className="text-sm text-slate-600 mt-1">✓ Built: {item.solutionCreated}</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ml-2 ${
                          item.status === 'in_daily_use'
                            ? 'bg-green-100 text-green-800'
                            : item.status === 'completed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.status === 'in_daily_use' ? 'Using It' : item.status === 'completed' ? 'Done' : 'Next'}
                        </span>
                      </div>
                      {item.reflection && (
                        <p className="text-sm text-slate-600 mt-2 italic">&quot;{item.reflection}&quot;</p>
                      )}
                      <p className="text-xs text-slate-500 mt-2">
                        {new Date(item.missionCompletedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-600 text-sm font-medium mb-4">No creations yet—let's build your first one</p>
                    <Link href="/discover">
                      <button className="inline-flex px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium">
                        + Build Something Now
                      </button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6 mb-6 border border-blue-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">What's Next?</h3>
              {portfolio && portfolio.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-700 font-medium">Keep building momentum.</p>
                  <Link href="/discover">
                    <button className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium">
                      Build Another Solution
                    </button>
                  </Link>
                  <p className="text-xs text-slate-600 text-center">Your creations compound. Build 3 and you'll see real change.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-700 font-medium">Ready to build something?</p>
                  <Link href="/discover">
                    <button className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium">
                      Start Building Now
                    </button>
                  </Link>
                  <p className="text-xs text-slate-600 text-center">25 minutes from start to a working tool.</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Account</h3>
              <div className="space-y-2">
                <Link href="/profile">
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-slate-700 text-sm font-medium transition">
                    Profile
                  </button>
                </Link>
                <Link href="/settings">
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-slate-700 text-sm font-medium transition">
                    Settings
                  </button>
                </Link>
                <Link href="/credits">
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-slate-700 text-sm font-medium transition">
                    Credits
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
