'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAnalytics } from '@/lib/analytics';
import { PenLine, Mail, ClipboardList, Code2, BarChart3, Search } from 'lucide-react';

// Page: "Let's Solve Something" (renamed from Discover)

const PROBLEM_CATEGORIES = [
  { id: 'writing', label: 'Writing', icon: PenLine },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'admin', label: 'Admin', icon: ClipboardList },
  { id: 'code', label: 'Code', icon: Code2 },
  { id: 'analysis', label: 'Analysis', icon: BarChart3 },
  { id: 'research', label: 'Research', icon: Search },
];

export default function DiscoverPage() {
  const router = useRouter();
  const [problem, setProblem] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const analytics = getAnalytics();

  useEffect(() => {
    // Get current user
    async function initUser() {
      try {
        const response = await fetch('/api/profile');
        if (response.ok) {
          const body = await response.json();
          const data = body?.data ?? body;
          setUserId(data.user?.id);
          // Log session start with baseline confidence
          if (data.user?.id) {
            analytics.setUser(data.user.id);
            analytics.logSessionStarted(data.user.id, 0.5); // Default baseline confidence
          }
        }
      } catch (err) {
        console.debug('Could not fetch user:', err);
      }
    }
    initUser();
  }, [analytics]);

  async function handleContinue() {
    if (!problem.trim()) {
      setError('Please describe what task you wish took less time');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create a LearnerGoal in the database
      const response = await fetch('/api/discover/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem: problem.trim(),
          description: `Solve: ${problem.trim()}`,
          problemArea: selectedCategory || 'general',
          timeframe: '4 weeks',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create goal');
      }

      const { goalId } = await response.json();

      // Log analytics: discover completed
      if (userId) {
        analytics.logDiscoverCompleted(userId, problem.trim(), goalId);
      }

      // Navigate to coach conversation with this goal
      router.push(`/coach?goalId=${goalId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Navigation */}
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/dashboard">
            <h1 className="text-2xl font-bold text-slate-900 hover:text-slate-700 cursor-pointer">LAO</h1>
          </Link>
          <div>
            <Link href="/dashboard">
              <button className="text-slate-600 hover:text-slate-900 text-sm font-medium">
                Back to Dashboard
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
          {/* Step indicator */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white text-sm font-bold">
                1
              </div>
              <span className="text-sm font-medium text-slate-600">Let's Start</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1">
              <div className="bg-blue-500 h-1 rounded-full" style={{ width: '20%' }}></div>
            </div>
          </div>

          {/* Main question */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">
              What's one thing you wish took less time?
            </h2>
            <p className="text-slate-600 text-lg">
              Tell me about something you do regularly that eats up your day. What would your week look like if you could skip this task?
            </p>
          </div>

          {/* Category selector */}
          <div className="mb-8">
            <p className="text-sm font-medium text-slate-700 mb-3">Quick categories (optional):</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PROBLEM_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  className={`p-3 rounded-lg border-2 transition text-center ${
                    selectedCategory === cat.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <cat.icon
                    size={24}
                    strokeWidth={1.5}
                    className="mb-1.5 text-brand-blue"
                    aria-hidden
                  />
                  <div className="text-sm font-medium text-slate-900">{cat.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Text input */}
          <div className="mb-8">
            <label htmlFor="problem" className="block text-sm font-medium text-slate-700 mb-2">
              Describe your task:
            </label>
            <textarea
              id="problem"
              value={problem}
              onChange={(e) => {
                setProblem(e.target.value);
                setError(null);
              }}
              placeholder="For example: I spend 30 minutes every morning organizing my email inbox. I wish I had a way to auto-sort and summarize important messages."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={5}
            />
            <p className="text-xs text-slate-500 mt-2">Be specific. What exactly do you do? How long does it take?</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Continue button */}
          <div className="flex gap-4">
            <button
              onClick={handleContinue}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Let\'s go...' : 'Let\'s Build Something →'}
            </button>
            <Link href="/dashboard">
              <button className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition">
                Cancel
              </button>
            </Link>
          </div>

          {/* Momentum message */}
          <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-slate-700">
              <span className="font-semibold">What's next:</span> I'll ask you a few questions about this problem, then we'll design your solution together. You'll have something built in 25 minutes.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
