'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAnalytics } from '@/lib/analytics';

export default function SolutionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goalId = searchParams.get('goalId');

  const [goalData, setGoalData] = useState<any>(null);
  const [mission, setMission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const analytics = getAnalytics();

  useEffect(() => {
    if (!goalId) {
      router.push('/discover');
      return;
    }

    async function loadSolution() {
      try {
        setLoading(true);

        // Get user
        const userResponse = await fetch('/api/profile');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUserId(userData.user?.id);
          if (userData.user?.id) {
            analytics.setUser(userData.user.id);
          }
        }

        const response = await fetch(`/api/solution/details?goalId=${goalId}`);

        if (!response.ok) {
          throw new Error('Failed to load solution');
        }

        const { goal, mission } = await response.json();
        setGoalData(goal);
        setMission(mission);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    loadSolution();
  }, [goalId, router, userId, analytics]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-600">Preparing your solution...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/discover">
            <button className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              Try Again
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Navigation */}
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/dashboard">
            <h1 className="text-2xl font-bold text-slate-900 hover:text-slate-700 cursor-pointer">LAO</h1>
          </Link>
          <div className="text-sm text-slate-600">Step 3 of 5: Your Plan</div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-8 text-white">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white bg-opacity-20 mb-4">
              <span className="text-2xl">🛠️</span>
            </div>
            <h2 className="text-3xl font-bold mb-2">Here's What We'll Build</h2>
            <p className="text-blue-100">
              25 minutes from now, you'll have a working tool that solves your problem
            </p>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Problem recap */}
            <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600 mb-1">Your problem:</p>
              <p className="text-lg font-semibold text-slate-900">{goalData?.problem}</p>
            </div>

            {/* Solution card */}
            {mission && (
              <div className="mb-8 p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">🤖</div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">
                      {mission.solutionDescription}
                    </h3>
                    <p className="text-slate-700 mb-4">
                      We'll create an AI assistant that takes your problem and solves it automatically.
                    </p>
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600">
                        <span className="font-semibold">What you'll have:</span> A working AI tool you can use immediately
                      </p>
                      <p className="text-sm text-slate-600">
                        <span className="font-semibold">How long:</span> 20-30 minutes
                      </p>
                      <p className="text-sm text-slate-600">
                        <span className="font-semibold">Difficulty:</span> Beginner-friendly (no coding required)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Steps preview */}
            <div className="mb-8">
              <h4 className="text-lg font-semibold text-slate-900 mb-4">Here's how we'll build it:</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-bold text-sm flex-shrink-0">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Define the task</p>
                    <p className="text-sm text-slate-600">We'll clarify exactly what the AI should do</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-bold text-sm flex-shrink-0">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Create the prompt</p>
                    <p className="text-sm text-slate-600">I'll help you write clear instructions for the AI</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-bold text-sm flex-shrink-0">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Test it out</p>
                    <p className="text-sm text-slate-600">We'll run a few examples to make sure it works</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-bold text-sm flex-shrink-0">
                    4
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">You're done!</p>
                    <p className="text-sm text-slate-600">You'll have a tool you can use immediately</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Info box */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-8">
              <p className="text-sm text-slate-700">
                <span className="font-semibold">No coding required.</span> You'll describe what you want, and we'll set up the AI to do it for you. I'll guide every step.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4">
              <button
                onClick={() => router.push(`/build?goalId=${goalId}`)}
                className="flex-1 px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
              >
                Build It Now →
              </button>
              <Link href="/discover">
                <button className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition">
                  Start Over
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Momentum message */}
        <div className="mt-8 text-center">
          <p className="text-slate-600 text-sm">
            You're 3 steps in. 2 more and you'll have something you can use tomorrow.
          </p>
        </div>
      </main>
    </div>
  );
}
