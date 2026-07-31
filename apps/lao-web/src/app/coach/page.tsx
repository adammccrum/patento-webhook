'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Message {
  role: 'coach' | 'user';
  content: string;
  timestamp: Date;
}

export default function CoachPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goalId = searchParams.get('goalId');

  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [coachLoading, setCoachLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [goalData, setGoalData] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize coach conversation
  useEffect(() => {
    if (!goalId) {
      router.push('/discover');
      return;
    }

    async function initializeConversation() {
      try {
        setLoading(true);
        const response = await fetch(`/api/coach/init?goalId=${goalId}`);

        if (!response.ok) {
          throw new Error('Failed to initialize conversation');
        }

        const { goal, conversation, initialMessage } = await response.json();

        setGoalData(goal);
        setStep(0);
        setMessages([
          {
            role: 'coach',
            content: initialMessage,
            timestamp: new Date(),
          },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    initializeConversation();
  }, [goalId, router]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSendMessage() {
    if (!userInput.trim() || !goalId) return;

    const userMessage = userInput.trim();
    setUserInput('');

    // Add user message to conversation
    setMessages((prev) => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);

    try {
      setCoachLoading(true);

      // Send to coach API to get streamed response
      const response = await fetch('/api/coach/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId,
          message: userMessage,
          step,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get coach response');
      }

      const data = await response.json();

      // Add coach response
      setMessages((prev) => [...prev, { role: 'coach', content: data.response, timestamp: new Date() }]);

      // Update step
      setStep(data.step);

      // If exploration complete, navigate to solution
      if (data.step >= 2 && data.recommendedAction) {
        // Save the conversation and navigate to solution recommendation
        await fetch('/api/coach/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goalId,
            messages: [...messages, { role: 'user', content: userMessage }],
            recommendation: data.recommendedAction,
            step: data.step,
          }),
        });

        router.push(`/solution?goalId=${goalId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
      setCoachLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your AI Coach...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Navigation */}
      <nav className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/dashboard">
            <h1 className="text-2xl font-bold text-slate-900 hover:text-slate-700 cursor-pointer">LAO</h1>
          </Link>
          <div className="text-sm text-slate-600">
            Step {step + 1} of 5: {['Understanding', 'Exploring', 'Planning', 'Building', 'Done'][step]}
          </div>
        </div>
      </nav>

      {/* Main Chat Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        <div className="bg-white rounded-lg shadow-lg flex flex-col h-full">
          {/* Goal Context */}
          {goalData && (
            <div className="p-6 border-b border-slate-200">
              <p className="text-sm text-slate-600">
                <span className="font-semibold">Your problem:</span> {goalData.problem}
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'coach' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-xl px-4 py-3 rounded-lg ${
                    msg.role === 'coach'
                      ? 'bg-slate-100 text-slate-900'
                      : 'bg-blue-500 text-white'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}

            {coachLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 text-slate-900 px-4 py-3 rounded-lg">
                  <div className="flex gap-2 items-center">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error message */}
          {error && (
            <div className="px-6 py-4 bg-red-50 border-t border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Input area */}
          <div className="p-6 border-t border-slate-200">
            <div className="flex gap-3">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !coachLoading) {
                    handleSendMessage();
                  }
                }}
                placeholder="Type your response..."
                disabled={coachLoading}
                className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSendMessage}
                disabled={coachLoading || !userInput.trim()}
                className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              The coach will ask 2-3 questions to understand your problem. Be honest about what's frustrating you.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
