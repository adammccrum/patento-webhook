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
        {/* Coach Welcome */}
        <div className="mb-8">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome back
            </h2>
            <p className="text-lg text-slate-600">
              {learnerState.problemsSolved === 0
                ? "Ready to solve your first problem?"
                : learnerState.problemsSolved === 1
                ? "You're building momentum. Let's keep going."
                : `You've solved ${learnerState.problemsSolved} problems. What's next?`}
            </p>
          </div>
        </div>

        {/* Impact Cards - Emotional Wins */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg shadow p-6 border-2 border-green-200">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Time You've Won Back</h3>
            <p className="text-4xl font-bold text-green-700 mb-2">
              {learnerState.problemsSolved > 0 ? `${learnerState.problemsSolved * 30}+` : '0'} min/week
            </p>
            <p className="text-slate-700">
              {learnerState.problemsSolved === 0
                ? 'Solve your first problem and start reclaiming time'
                : learnerState.problemsSolved === 1
                ? 'One solution. Keep building for compounding results.'
                : 'Your solutions are saving you time every single week.'}
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow p-6 border-2 border-blue-200">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Problems Solved</h3>
            <p className="text-4xl font-bold text-blue-700 mb-2">
              {learnerState.problemsSolved || 0}
            </p>
            <p className="text-slate-700">
              {learnerState.problemsSolved === 0
                ? 'Each solution changes how you work.'
                : learnerState.problemsSolved === 1
                ? 'One down. The pattern is real. Build another.'
                : `${Math.min(5 - learnerState.problemsSolved, 5)} more to complete your toolkit.`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-900">My Solutions</h3>
                <span className="text-sm text-slate-500">{portfolio?.length || 0} transformation{portfolio?.length !== 1 ? 's' : ''}</span>
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
                  <div className="text-center py-12">
                    <p className="text-slate-700 font-medium mb-2">Your journey starts with one problem solved.</p>
                    <p className="text-slate-600 text-sm mb-6">Pick something that wastes your time, and solve it with AI.</p>
                    <Link href="/course/1">
                      <button className="inline-flex px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition text-sm font-medium">
                        Solve Your First Problem
                      </button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg shadow p-6 mb-6 border-2 border-purple-200">
              <h3 className="text-lg font-semibold text-slate-900 mb-3">
                {learnerState.problemsSolved === 0 ? "Your Next Problem" : "Keep Building"}
              </h3>
              {portfolio && portfolio.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {learnerState.problemsSolved === 1
                      ? "You felt it work once. Build another. The pattern becomes unstoppable."
                      : `You've solved ${learnerState.problemsSolved}. Each solution compounds. What problem did you think about while building?`}
                  </p>
                  <Link href={learnerState.problemsSolved >= 5 ? "/course/1" : "/course/1"}>
                    <button className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition text-sm font-medium">
                      {learnerState.problemsSolved >= 5 ? "See Your Toolkit" : "Solve Your Next Problem"}
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Most people think AI is complicated. It's not. Pick a problem that wastes your time right now, and solve it in 25 minutes.
                  </p>
                  <Link href="/course/1">
                    <button className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition text-sm font-medium">
                      Solve Your First Problem
                    </button>
                  </Link>
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
