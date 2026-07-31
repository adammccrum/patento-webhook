'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAnalytics } from '@/lib/analytics';

interface BuildStep {
  id: number;
  title: string;
  description: string;
  prompt: string;
  inputLabel: string;
  placeholder: string;
  example: string;
}

const BUILD_STEPS: BuildStep[] = [
  {
    id: 1,
    title: 'Define the Task',
    description: 'What exactly do you want the AI to do?',
    prompt: 'In one sentence: what should this AI tool do? Be specific about what it takes in and what it should produce.',
    inputLabel: 'What should it do?',
    placeholder: 'e.g., Analyze emails and create a one-sentence summary',
    example: 'My task: Summarize long emails into key action items',
  },
  {
    id: 2,
    title: 'Create the Prompt',
    description: 'Give the AI clear instructions',
    prompt: 'You\'re doing great. Now I need to know: What format should the output be in? Any rules or standards the AI should follow?',
    inputLabel: 'Give the AI instructions:',
    placeholder: 'e.g., Output should be a bullet list of action items, max 3 items, prioritized by urgency',
    example: 'Be concise, extract action items, mark deadlines in bold',
  },
  {
    id: 3,
    title: 'Test It Out',
    description: 'Make sure it works as expected',
    prompt: 'Final step: let\'s test this with real data. Give me an example of what you\'d normally feed into this tool.',
    inputLabel: 'Test with a real example:',
    placeholder: 'Paste an example email, document, or text here...',
    example: 'The Johnson proposal came in today. They want feedback by Friday. Also need quote for phase 2.',
  },
  {
    id: 4,
    title: 'You\'re Done!',
    description: 'Your AI assistant is ready to use',
    prompt: 'You just built something real. This tool is going to save you time every single week from now on.',
    inputLabel: '',
    placeholder: '',
    example: '',
  },
];

export default function BuildPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goalId = searchParams.get('goalId');
  const buildStartTimeRef = useRef(Date.now());
  const analytics = getAnalytics();

  const [currentStep, setCurrentStep] = useState(1);
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goalData, setGoalData] = useState<any>(null);
  const [coachResponses, setCoachResponses] = useState<Record<number, string>>({});
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
          const userData = await userResponse.json();
          setUserId(userData.user?.id);
          if (userData.user?.id) {
            analytics.logBuildSessionStarted(userData.user.id, goalId);
          }
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
  }, [goalId, router, analytics]);

  async function handleStepComplete() {
    if (currentStep === 4) {
      // Complete the mission
      try {
        setLoading(true);
        const buildDurationMillis = Date.now() - buildStartTimeRef.current;
        const sessionId = analytics.getSessionId();

        const response = await fetch('/api/build/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goalId,
            stepData: inputs,
            buildDurationMillis,
            sessionId,
          }),
        });

        if (response.ok && userId) {
          analytics.logAssetCreated(userId, goalId, goalId);
        }

        // Navigate to reflection
        router.push(`/reflection?goalId=${goalId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
      return;
    }

    // Get AI coach response for next step
    if (!inputs[currentStep]) {
      setError('Please provide input before continuing');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/build/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId,
          step: currentStep,
          input: inputs[currentStep],
        }),
      });

      if (!response.ok) throw new Error('Failed to process step');

      const data = await response.json();
      setCoachResponses((prev) => ({ ...prev, [currentStep]: data.response }));

      if (userId) {
        analytics.logBuildStepCompleted(userId, goalId, currentStep, inputs[currentStep]);
      }

      setCurrentStep(currentStep + 1);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  const step = BUILD_STEPS[currentStep - 1];

  if (!goalData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
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
          <div className="text-sm text-slate-600">Building: {step?.title}</div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            ></div>
          </div>
          <p className="text-sm text-slate-600 mt-2">Step {currentStep} of 4</p>
        </div>

        {/* Build interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar: Steps */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Build Process</h3>
              <div className="space-y-3">
                {BUILD_STEPS.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => idx + 1 <= currentStep && setCurrentStep(idx + 1)}
                    disabled={idx + 1 > currentStep}
                    className={`w-full text-left p-3 rounded-lg transition ${
                      idx + 1 === currentStep
                        ? 'bg-blue-50 border-l-4 border-blue-500'
                        : idx + 1 < currentStep
                          ? 'hover:bg-slate-50'
                          : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          idx + 1 < currentStep
                            ? 'bg-green-500 text-white'
                            : idx + 1 === currentStep
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-300 text-slate-600'
                        }`}
                      >
                        {idx + 1 < currentStep ? '✓' : s.id}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{s.title}</p>
                        <p className="text-xs text-slate-500">{s.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main: Step content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-8">
              {/* Coach prompt */}
              <div className="mb-8 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                <p className="text-slate-700 leading-relaxed">🤖 <span className="font-medium">Your Coach:</span> {step?.prompt}</p>
              </div>

              {/* Input area */}
              {step?.inputLabel && (
                <div className="mb-8">
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    {step.inputLabel}
                  </label>
                  <div className="mb-2">
                    <textarea
                      value={inputs[currentStep] || ''}
                      onChange={(e) => setInputs({ ...inputs, [currentStep]: e.target.value })}
                      placeholder={step.placeholder}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={5}
                    />
                  </div>
                  {step.example && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-slate-600 hover:text-slate-900 font-medium">
                        Show example
                      </summary>
                      <div className="mt-2 p-3 bg-slate-100 rounded text-slate-700">
                        {step.example}
                      </div>
                    </details>
                  )}
                </div>
              )}

              {/* Coach response from previous step */}
              {coachResponses[currentStep - 1] && (
                <div className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-sm text-slate-600 font-medium mb-2">Coach's feedback:</p>
                  <p className="text-slate-700 leading-relaxed">{coachResponses[currentStep - 1]}</p>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Completion message */}
              {currentStep === 4 && (
                <div className="mb-8 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg text-center">
                  <div className="text-4xl mb-4">🎉</div>
                  <h3 className="text-2xl font-bold text-green-900 mb-2">You've built your AI assistant!</h3>
                  <p className="text-green-800 mb-4">
                    You now have a working tool that will save you time on "{goalData?.problem}"
                  </p>
                  <p className="text-sm text-green-700">
                    Next, we'll capture this in your portfolio and show you how to use it.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-4">
                {currentStep > 1 && !loading && (
                  <button
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition"
                  >
                    ← Back
                  </button>
                )}
                <button
                  onClick={handleStepComplete}
                  disabled={loading || (step?.inputLabel && !inputs[currentStep])}
                  className="flex-1 px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
                >
                  {loading ? 'Processing...' : currentStep === 4 ? 'Complete & Celebrate →' : 'Next Step →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
