'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Mission {
  id: string;
  courseId: string;
  title: string;
  tagline: string;
  description: string;
  problemArea: string;
  toolkitName: string;
  achievement: string;
  overview: string;
  coachPrompt: string;
  reflectionPrompt: string;
  buildTemplate?: string;
}

export default function MissionPage() {
  const router = useRouter();
  const params = useParams();
  const missionId = params.id as string;

  const [mission, setMission] = useState<Mission | null>(null);
  const [step, setStep] = useState<'overview' | 'coach' | 'build' | 'reflection' | 'celebration'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [problemInput, setProblemInput] = useState('');
  const [solutionContent, setSolutionContent] = useState('');
  const [reflection, setReflection] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [solutionId, setSolutionId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMission() {
      try {
        const response = await fetch(`/api/missions/${missionId}`);
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/login');
            return;
          }
          throw new Error('Failed to load mission');
        }

        const data = await response.json();
        setMission(data.mission);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (missionId) {
      fetchMission();
    }
  }, [missionId, router]);

  const handleStartBuild = () => {
    if (problemInput.trim()) {
      // Give them the template as a starting point rather than a blank page.
      if (!solutionContent && mission?.buildTemplate) {
        setSolutionContent(mission.buildTemplate);
      }
      setStep('build');
    } else {
      setError('Please describe your problem first');
    }
  };

  const handleFinishBuild = () => {
    if (!solutionContent.trim()) {
      setError('Write your solution before moving on — this is what you keep');
      return;
    }
    setError(null);
    setStep('reflection');
  };

  const handleCompleteMission = async () => {
    if (!reflection.trim()) {
      setError('Please share your reflection');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/missions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missionId,
          courseId: mission?.courseId,
          reflection,
          problem: problemInput,
          content: solutionContent,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete mission');
      }

      const data = await response.json();
      setSolutionId(data.solution?.id ?? null);
      setStep('celebration');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-red-600">{error || 'Mission not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Navigation */}
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/dashboard">
            <h1 className="text-2xl font-bold text-slate-900 hover:text-slate-700 cursor-pointer">
              LAO
            </h1>
          </Link>
          <div className="text-sm text-slate-600">{mission.title}</div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Overview Step */}
        {step === 'overview' && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="mb-6">
              <p className="text-lg font-bold text-blue-600 mb-2">{mission.tagline}</p>
              <h2 className="text-4xl font-bold text-slate-900 mb-4">{mission.title}</h2>
            </div>

            <p className="text-lg text-slate-700 mb-8 leading-relaxed">{mission.overview}</p>

            <div className="bg-green-50 border-l-4 border-green-500 p-6 mb-8 rounded-lg">
              <p className="text-slate-700 font-medium mb-2">What you'll solve:</p>
              <p className="text-slate-700">{mission.description}</p>
              <p className="text-sm text-slate-600 mt-3 font-medium">{mission.achievement}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm font-semibold text-slate-900 mb-2">Toolkit Item</p>
                <p className="text-slate-700 font-bold">{mission.toolkitName}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm font-semibold text-slate-900 mb-2">Area</p>
                <p className="text-slate-700">{mission.problemArea}</p>
              </div>
            </div>

            <button
              onClick={() => setStep('coach')}
              className="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
            >
              Start Mission →
            </button>
          </div>
        )}

        {/* Coach Step */}
        {step === 'coach' && (
          <div className="bg-white rounded-lg shadow p-8">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">Describe Your Problem</h3>

            <div className="mb-8 p-6 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
              <p className="text-slate-700 leading-relaxed text-lg">
                <span className="font-medium">Let's understand:</span> {mission.coachPrompt}
              </p>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-semibold text-slate-900 mb-3">
                The problem I'm solving:
              </label>
              <textarea
                value={problemInput}
                onChange={(e) => {
                  setProblemInput(e.target.value);
                  setError(null);
                }}
                placeholder="Be specific. What's your situation?"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={6}
              />
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setStep('overview')}
                className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition"
              >
                ← Back
              </button>
              <button
                onClick={handleStartBuild}
                className="flex-1 px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
              >
                Let's Build →
              </button>
            </div>
          </div>
        )}

        {/* Build Step */}
        {step === 'build' && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Solving Your Problem</h3>
              <p className="text-slate-700 mb-4">
                Your problem: <span className="font-semibold">"{problemInput}"</span>
              </p>
              <p className="text-slate-600 text-sm">You'll build a {mission.toolkitName.toLowerCase()} to solve it.</p>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-semibold text-slate-900 mb-3">
                Your {mission.toolkitName.toLowerCase()}:
              </label>
              <textarea
                value={solutionContent}
                onChange={(e) => {
                  setSolutionContent(e.target.value);
                  setError(null);
                }}
                placeholder="Write the instructions you'll give the AI. Be specific about the task, the format you want back, and anything it should avoid."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={14}
              />
              <p className="text-xs text-slate-600 mt-2">
                This is yours to keep. You&apos;ll be able to run it, improve it and version it from your toolbox.
              </p>
            </div>

            <div className="mb-8 p-6 bg-green-50 border-l-4 border-green-500 rounded-lg">
              <p className="text-slate-700 leading-relaxed">
                <span className="font-semibold">Remember:</span> Define the task, write clear instructions, test with real examples.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setStep('coach');
                  setError(null);
                }}
                className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition"
              >
                ← Back
              </button>
              <button
                onClick={handleFinishBuild}
                className="flex-1 px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
              >
                Problem Solved →
              </button>
            </div>
          </div>
        )}

        {/* Reflection Step */}
        {step === 'reflection' && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-slate-900 mb-3">One quick note</h3>
              <p className="text-slate-700">{mission.reflectionPrompt}</p>
            </div>

            <div className="mb-8">
              <textarea
                value={reflection}
                onChange={(e) => {
                  setReflection(e.target.value);
                  setError(null);
                }}
                placeholder="Share your thoughts..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                rows={6}
              />
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setStep('build')}
                className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition"
              >
                ← Back
              </button>
              <button
                onClick={handleCompleteMission}
                disabled={submitting}
                className="flex-1 px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition disabled:opacity-50"
              >
                {submitting ? 'Saving...' : 'Save Solution'}
              </button>
            </div>
          </div>
        )}

        {/* Quiet Acknowledgement */}
        {step === 'celebration' && mission && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="mb-6">
              <p className="text-2xl font-semibold text-slate-900">✓ Solution saved</p>
            </div>

            <div className="mb-8 p-6 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-slate-700 mb-2">
                {mission.achievement.toLowerCase().charAt(0).toUpperCase() + mission.achievement.toLowerCase().slice(1)}.
              </p>
              <p className="text-sm text-slate-600">
                {mission.toolkitName} is in your toolbox now. Use it, and improve it as you go.
              </p>
            </div>

            <div className="flex gap-3 justify-center">
              {solutionId && (
                <button
                  onClick={() => router.push(`/solutions/${solutionId}`)}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium"
                >
                  Open {mission.toolkitName}
                </button>
              )}
              <button
                onClick={() => router.push(`/course/${mission?.courseId}`)}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-medium"
              >
                Next Problem
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
