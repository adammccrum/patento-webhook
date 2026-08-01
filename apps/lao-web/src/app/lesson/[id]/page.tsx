'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Lesson {
  id: string;
  title: string;
  description: string;
  problemArea: string;
  overview: string;
  coachPrompt: string;
  reflectionPrompt: string;
  buildTemplate?: string;
}

export default function LessonPage() {
  const router = useRouter();
  const params = useParams();
  const lessonId = params.id as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [step, setStep] = useState<'overview' | 'coach' | 'build' | 'reflection'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [problemInput, setProblemInput] = useState('');
  const [processedStep, setProcessedStep] = useState(false);

  useEffect(() => {
    async function fetchLesson() {
      try {
        const response = await fetch(`/api/lessons/${lessonId}`);
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/login');
            return;
          }
          throw new Error('Failed to load lesson');
        }

        const data = await response.json();
        setLesson(data.lesson);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (lessonId) {
      fetchLesson();
    }
  }, [lessonId, router]);

  const handleStartBuild = () => {
    if (problemInput.trim()) {
      setStep('build');
      setProcessedStep(true);
    } else {
      setError('Please describe your problem first');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-red-600">{error || 'Lesson not found'}</div>
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
          <div className="text-sm text-slate-600">{lesson.title}</div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Step indicator */}
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
            <h2 className="text-3xl font-bold text-slate-900 mb-4">{lesson.title}</h2>
            <p className="text-lg text-slate-700 mb-6">{lesson.overview}</p>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8 rounded">
              <p className="text-slate-700">
                <span className="font-semibold">What you'll build:</span> {lesson.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm font-semibold text-slate-900 mb-2">Problem Area</p>
                <p className="text-slate-700">{lesson.problemArea}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="text-sm font-semibold text-slate-900 mb-2">Learning Path</p>
                <p className="text-slate-700">Overview → Coach → Build → Reflection</p>
              </div>
            </div>

            <button
              onClick={() => setStep('coach')}
              className="w-full px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
            >
              Start Lesson →
            </button>
          </div>
        )}

        {/* Coach Step */}
        {step === 'coach' && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="mb-8 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
              <p className="text-slate-700 leading-relaxed">
                🤖 <span className="font-medium">Your Coach:</span> {lesson.coachPrompt}
              </p>
            </div>

            <div className="mb-8">
              <label className="block text-sm font-semibold text-slate-900 mb-2">
                Tell me about your situation:
              </label>
              <textarea
                value={problemInput}
                onChange={(e) => {
                  setProblemInput(e.target.value);
                  setError(null);
                }}
                placeholder="Describe the specific problem you want to solve with this AI assistant..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={5}
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
                Build Now →
              </button>
            </div>
          </div>
        )}

        {/* Build Step */}
        {step === 'build' && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Building Your Assistant</h3>
              <p className="text-slate-700 mb-4">
                You're building an AI assistant to solve: <span className="font-semibold">"{problemInput}"</span>
              </p>
            </div>

            {lesson.buildTemplate && (
              <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-sm font-semibold text-slate-900 mb-3">Template (optional starting point):</p>
                <pre className="text-xs text-slate-700 overflow-x-auto">{lesson.buildTemplate}</pre>
              </div>
            )}

            <div className="mb-8 p-6 bg-blue-50 border-l-4 border-blue-500 rounded">
              <p className="text-slate-700 leading-relaxed">
                Use the same process you learned: define the task, create clear instructions, test with real examples.
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setStep('coach');
                  setProcessedStep(false);
                }}
                className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep('reflection')}
                className="flex-1 px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition"
              >
                I've Built It →
              </button>
            </div>
          </div>
        )}

        {/* Reflection Step */}
        {step === 'reflection' && (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-4">Reflect on What You Built</h3>
              <p className="text-slate-700">{lesson.reflectionPrompt}</p>
            </div>

            <div className="mb-8">
              <textarea
                placeholder="Share your reflection..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={6}
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep('build')}
                className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition"
              >
                ← Back
              </button>
              <button className="flex-1 px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition">
                Complete Lesson 🎉
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
