'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface TodayMetrics {
  newLearners: number;
  sessionsStarted: number;
  sessionsCompleted: number;
  problemsSolved: number;
  assetsCreated: number;
  avgTTFT: number;
  avgTTC: number;
  confidenceIncrease: number;
}

interface FunnelStage {
  stage: string;
  count: number;
  conversionFromPrevious: number;
  averageTimeSeconds: number;
  abandonmentPercent: number;
}

interface Reflection {
  id: string;
  reflection: string;
  completedAt: string;
  learnerEmail: string;
  learnerName?: string;
  problem: string;
  hasConfidenceLanguage: boolean;
}

interface FrictionIssue {
  type: string;
  metric: string;
  value: number | string;
  recommendation: string;
}

interface WeeklyData {
  weeklyTransformations: number;
  lastWeekTransformations: number;
  weekOverWeekChangePercent: number;
  dailyBreakdown: { day: string; count: number }[];
}

export default function FounderDashboard() {
  const router = useRouter();
  const [today, setToday] = useState<TodayMetrics | null>(null);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [friction, setFriction] = useState<FrictionIssue[]>([]);
  const [weekly, setWeekly] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [todayRes, funnelRes, reflectionsRes, frictionRes, weeklyRes] =
          await Promise.all([
            fetch('/api/founder/today'),
            fetch('/api/founder/funnel'),
            fetch('/api/founder/reflections?limit=10'),
            fetch('/api/founder/friction'),
            fetch('/api/founder/weekly-transformations'),
          ]);

        if (!todayRes.ok) {
          if (todayRes.status === 401) {
            router.push('/auth/login');
            return;
          }
          throw new Error('Failed to fetch dashboard');
        }

        const todayData = await todayRes.json();
        const funnelData = await funnelRes.json();
        const reflectionsData = await reflectionsRes.json();
        const frictionData = await frictionRes.json();
        const weeklyData = await weeklyRes.json();

        setToday(todayData);
        setFunnel(funnelData.funnel);
        setReflections(reflectionsData.reflections);
        setFriction(frictionData.friction);
        setWeekly(weeklyData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900">LAO Operations</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <Link href="/dashboard">
              <button className="text-slate-600 hover:text-slate-900 text-sm font-medium">
                Dashboard
              </button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Section 1: Today */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Today</h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'New Learners', value: today?.newLearners || 0 },
              { label: 'Sessions Started', value: today?.sessionsStarted || 0 },
              { label: 'Sessions Completed', value: today?.sessionsCompleted || 0 },
              { label: 'Problems Solved', value: today?.problemsSolved || 0 },
              { label: 'Assets Created', value: today?.assetsCreated || 0 },
              { label: 'Avg TTFT (sec)', value: today?.avgTTFT || 0 },
              { label: 'Avg TTC (sec)', value: today?.avgTTC || 0 },
              {
                label: 'Confidence Increase',
                value: `+${(today?.confidenceIncrease || 0).toFixed(2)}`,
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className="bg-slate-50 border border-slate-200 rounded p-4"
              >
                <p className="text-xs font-medium text-slate-600 mb-2">{metric.label}</p>
                <p className="text-2xl font-bold text-slate-900">{metric.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Learner Journey Funnel */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Learner Journey</h2>
          <div className="space-y-3">
            {funnel.map((stage, idx) => (
              <div key={stage.stage} className="bg-slate-50 border border-slate-200 rounded p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-slate-900 w-24">{stage.stage}</span>
                    <span className="text-sm text-slate-600">{stage.count} learners</span>
                    {idx > 0 && (
                      <span className="text-sm text-slate-600">
                        {Math.round(stage.conversionFromPrevious)}% conversion
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-red-600">
                    {Math.round(stage.abandonmentPercent)}% abandon
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min(100, (stage.count / (funnel[0]?.count || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Learner Voice */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Learner Voice</h2>
          <div className="space-y-6">
            {reflections.length > 0 ? (
              reflections.map((reflection) => (
                <div key={reflection.id} className="border border-slate-200 rounded p-6 bg-slate-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {reflection.learnerName || reflection.learnerEmail}
                      </p>
                      <p className="text-xs text-slate-600">
                        Solved: "{reflection.problem}"
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-600">
                        {new Date(reflection.completedAt).toLocaleDateString()}
                      </p>
                      {reflection.hasConfidenceLanguage && (
                        <span className="inline-block mt-1 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Confident
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{reflection.reflection}</p>
                </div>
              ))
            ) : (
              <p className="text-slate-600 text-sm">No reflections yet</p>
            )}
          </div>
        </section>

        {/* Section 4: Product Friction */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Product Friction</h2>
          <div className="space-y-4">
            {friction.length > 0 ? (
              friction.map((issue, idx) => (
                <div key={idx} className="border-l-4 border-red-500 bg-red-50 p-4 rounded">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-slate-900">{issue.type}</p>
                    <span className="text-sm text-slate-600">{issue.metric}</span>
                  </div>
                  <p className="text-sm text-slate-700">{issue.recommendation}</p>
                </div>
              ))
            ) : (
              <p className="text-slate-600 text-sm">No critical friction detected</p>
            )}
          </div>
        </section>

        {/* Section 5: Weekly Transformation (Headline Metric) */}
        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-8 text-center">
          <p className="text-sm font-semibold text-slate-600 mb-2">WEEKLY TRANSFORMATIONS</p>
          <p className="text-5xl font-bold text-blue-900 mb-2">
            {weekly?.weeklyTransformations || 0}
          </p>
          <p className="text-slate-700 mb-4">people solved a real problem with AI this week</p>
          {weekly && (
            <div>
              <p className="text-sm text-slate-600">
                Last week: {weekly.lastWeekTransformations}{' '}
                <span
                  className={
                    weekly.weekOverWeekChangePercent >= 0
                      ? 'text-green-600 font-semibold'
                      : 'text-red-600 font-semibold'
                  }
                >
                  ({weekly.weekOverWeekChangePercent > 0 ? '+' : ''}
                  {weekly.weekOverWeekChangePercent}%)
                </span>
              </p>
              <div className="flex justify-center gap-2 mt-4">
                {weekly.dailyBreakdown.map((day) => (
                  <div key={day.day} className="text-center">
                    <p className="text-xs text-slate-600 mb-1">{day.day}</p>
                    <div
                      className="w-8 bg-blue-500 rounded"
                      style={{
                        height: `${Math.max(20, day.count * 20)}px`,
                      }}
                    />
                    <p className="text-xs text-slate-600 mt-1">{day.count}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
