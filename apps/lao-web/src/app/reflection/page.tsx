'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAnalytics } from '@/lib/analytics';
import { Check } from 'lucide-react';

export default function ReflectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goalId = searchParams.get('goalId');
  const analytics = getAnalytics();
  const reflectionPageLoadTimeRef = useRef(Date.now());

  const [reflection, setReflection] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goalData, setGoalData] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!goalId) {
      router.push('/discover');
      return;
    }

    async function loadGoal() {
      try {
        // Get user
        const userResponse = await fetch('/api/profile');
        if (userResponse.ok) {
          const userBody = await userResponse.json();
          const userData = userBody?.data ?? userBody;
          setUserId(userData.user?.id);
        }

        const response = await fetch(`/api/solution/details?goalId=${goalId}`);
        if (!response.ok) throw new Error('Failed to load goal');
        const { goal } = await response.json();
        setGoalData(goal);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    }

    loadGoal();
  }, [goalId, router]);

  async function handleSubmit() {
    if (!goalId) return;
    if (!reflection.trim()) {
      setError('Please share your reflection');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ttftMillis = Date.now() - reflectionPageLoadTimeRef.current;

      const sessionId = analytics.getSessionId();

      const response = await fetch('/api/reflection/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId,
          reflection: reflection.trim(),
          ttftMillis,
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit reflection');
      }

      if (userId) {
        analytics.logReflectionSubmitted(userId, goalId, reflection.trim(), 0.7);
        analytics.logSessionCompleted(userId, goalId, true);
      }

      setSubmitted(true);

      // Redirect to dashboard after a moment
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  }

  if (!goalData) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Navigation */}
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/dashboard">
            <h1 className="text-2xl font-bold text-slate-900 hover:text-slate-700 cursor-pointer">LAO</h1>
          </Link>
          <div className="text-sm text-slate-600">Step 5 of 5: What Did You Learn?</div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {submitted ? (
          // Celebration screen
          <div className="text-center">
            <div className="mb-8">
              <Check size={48} strokeWidth={1.5} className="text-success mb-4 mx-auto" aria-hidden />
              <h2 className="text-4xl font-bold text-slate-900 mb-4">
                You did it!
              </h2>
              <p className="text-xl text-slate-700 mb-8">
                You've built an AI tool to solve "{goalData?.problem}"
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-slate-900 mb-4">What you accomplished:</h3>
                <div className="space-y-3 text-left max-w-2xl mx-auto">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">✓</span>
                    <div>
                      <p className="font-semibold text-slate-900">Identified your problem</p>
                      <p className="text-sm text-slate-600">You were clear about what was taking too much time</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">✓</span>
                    <div>
                      <p className="font-semibold text-slate-900">Explored with AI Coach</p>
                      <p className="text-sm text-slate-600">You understood your needs better through conversation</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">✓</span>
                    <div>
                      <p className="font-semibold text-slate-900">Built a solution</p>
                      <p className="text-sm text-slate-600">You created a real, working AI tool in 25 minutes</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">✓</span>
                    <div>
                      <p className="font-semibold text-slate-900">Reflected on your journey</p>
                      <p className="text-sm text-slate-600">You're already thinking about how to improve</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-left">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">Next step:</span> Your reflection has been saved. You can now see this achievement in your portfolio on your dashboard. Use your new tool in the coming days, and come back to tell us how it's working.
                </p>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="px-8 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition"
              >
                See Your Portfolio
              </button>
              <button
                onClick={() => router.push('/discover')}
                className="px-8 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-white transition"
              >
                Build Another
              </button>
            </div>

            <div className="mt-12 text-center text-slate-600 text-sm">
              <p>Redirecting to dashboard in 3 seconds...</p>
            </div>
          </div>
        ) : (
          // Reflection form
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="mb-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500 text-white text-xl mb-4 mx-auto">
                ✓
              </div>
              <h2 className="text-3xl font-bold text-center text-slate-900 mb-2">
                Great job building your AI assistant!
              </h2>
              <p className="text-center text-slate-600">
                Take a moment to reflect on what you've accomplished
              </p>
            </div>

            {/* Problem recap */}
            <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600 mb-1">Problem you solved:</p>
              <p className="font-semibold text-slate-900">{goalData?.problem}</p>
            </div>

            {/* Reflection questions */}
            <div className="mb-8">
              <label htmlFor="reflection" className="block text-sm font-semibold text-slate-900 mb-2">
                What changed for you?
              </label>
              <p className="text-xs text-slate-500 mb-3">
                How does solving this problem change your week? What was the biggest surprise?
              </p>
              <textarea
                id="reflection"
                value={reflection}
                onChange={(e) => {
                  setReflection(e.target.value);
                  setError(null);
                }}
                placeholder="For example: I didn't expect I could actually build this in 25 minutes. Now I can see how AI could help with other things too."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={5}
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Info box */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-8">
              <p className="text-sm text-slate-700">
                <span className="font-semibold">Your reflection helps:</span> It helps us understand what works and what doesn't, so we can make the experience better for everyone.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleSubmit}
                disabled={loading || !reflection.trim()}
                className="flex-1 px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
              >
                {loading ? 'Saving...' : 'Complete'}
              </button>
              <button
                onClick={() => setReflection('')}
                className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
