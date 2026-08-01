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
  const [step, setStep] = useState<'overview' | 'coach' | 'build' | 'reflection'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [problemInput, setProblemInput] = useState('');
  const [reflection, setReflection] = useState('');

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
      setStep('build');
    } else {
      setError('Please describe your problem first');
    }
  };

  const handleCompleteMission = async () => {
    if (!reflection.trim()) {
      setError('Please share your reflection');
      return;
    }

    try {
      const response = await fetch('/api/missions/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missionId,
          courseId: mission?.courseId,
          reflection,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete mission');
      }

      // Redirect to course
      router.push(`/course/${mission?.courseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-red-600">{error || 'Mission not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
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
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${
                  step === 'overview'
                    ? '25%'
                    : step === 'coach'
                      ? '50%'
                      : step === 'build'
                        ? '75%'
                        : '100%'
                }%`,
              }}
            />
          </div>
        </div>

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

            {mission.buildTemplate && (
              <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-sm font-semibold text-slate-900 mb-3">Starting template (customize it):</p>
                <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap">{mission.buildTemplate}</pre>
              </div>
            )}

            <div className="mb-8 p-6 bg-green-50 border-l-4 border-green-500 rounded-lg">
              <p className="text-slate-700 leading-relaxed">
                <span className="font-semibold">Remember:</span> Define the task, write clear instructions, test with real examples.
              </p>
            </div>

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
                onClick={() => setStep('reflection')}
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
              <h3 className="text-2xl font-bold text-slate-900 mb-2">You've Solved Something Real</h3>
              <p className="text-slate-600 mb-2">Now that {problemInput.toLowerCase()} no longer consumes your time:</p>
              <p className="text-slate-700 mb-6">{mission.reflectionPrompt}</p>
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
                className="flex-1 px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition"
              >
                Add to My Solutions ✓
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
