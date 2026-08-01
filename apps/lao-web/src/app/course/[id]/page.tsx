'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Mission {
  id: string;
  title: string;
  tagline: string;
  description: string;
  position: number;
  problemArea: string;
  toolkitName: string;
  achievement: string;
  timeSavedMinutes?: number;
}

interface Course {
  id: string;
  title: string;
  description: string;
  missions: Mission[];
}

interface Enrollment {
  currentMissionPosition: number;
  missionsCompleted: number;
  toolkitItems: Array<{
    missionId: string;
    title: string;
    toolkitName: string;
    impact?: string;
    problemArea?: string;
    reflection?: string;
    completedAt: string
  }>;
}

export default function CoursePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successAnswer, setSuccessAnswer] = useState('');
  const [submittingSuccess, setSubmittingSuccess] = useState(false);

  useEffect(() => {
    async function fetchCourse() {
      try {
        const response = await fetch(`/api/courses/${courseId}`);
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/login');
            return;
          }
          throw new Error('Failed to load course');
        }

        const data = await response.json();
        setCourse(data.course);
        setEnrollment(data.enrollment);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (courseId) {
      fetchCourse();
    }
  }, [courseId, router]);

  const handleSubmitSuccess = async () => {
    if (!successAnswer.trim()) {
      setError('Please share which assistant you'll use');
      return;
    }

    setSubmittingSuccess(true);
    try {
      const response = await fetch('/api/course/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          successAnswer,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }

      // Redirect to dashboard or show success state
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmittingSuccess(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-red-600">{error || 'Course not found'}</div>
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
          <div className="text-sm text-slate-600">Your transformation journey</div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Course Header */}
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">{course.title}</h2>
          <p className="text-lg text-slate-700 mb-6">{course.description}</p>

          {/* Achievements, not progress */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            {enrollment && enrollment.missionsCompleted === 0 && (
              <p className="text-lg font-semibold text-slate-900">
                {course.missions.length} wins waiting for you
              </p>
            )}
            {enrollment && enrollment.missionsCompleted > 0 && enrollment.missionsCompleted < course.missions.length && (
              <p className="text-lg font-semibold text-slate-900">
                ✓ You've solved {enrollment.missionsCompleted} real problem{enrollment.missionsCompleted !== 1 ? 's' : ''}.<br />
                {course.missions.length - enrollment.missionsCompleted} more wins until you complete your AI toolkit.
              </p>
            )}
            {enrollment && enrollment.missionsCompleted === course.missions.length && (
              <p className="text-lg font-semibold text-green-900">
                ✓ All {course.missions.length} missions complete!
              </p>
            )}
          </div>
        </div>

        {/* Missions Grid */}
        <div className="space-y-4 mb-12">
          {course.missions.map((mission, idx) => {
            const isCompleted = enrollment && idx < enrollment.missionsCompleted;
            const isCurrentOrNext =
              enrollment && (idx === enrollment.currentMissionPosition || idx <= enrollment.currentMissionPosition);
            const isLocked = enrollment && idx > enrollment.currentMissionPosition;

            return (
              <Link key={mission.id} href={`/mission/${mission.id}`}>
                <div
                  className={`p-6 rounded-lg border-2 transition cursor-pointer ${
                    isLocked
                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                      : isCompleted
                        ? 'bg-green-50 border-green-300'
                        : isCurrentOrNext
                          ? 'bg-blue-50 border-blue-500'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                            isCompleted
                              ? 'bg-green-500 text-white'
                              : isCurrentOrNext
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-300 text-slate-600'
                          }`}
                        >
                          {isCompleted ? '✓' : mission.position}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{mission.title}</h3>
                          <p className="text-sm text-slate-600">{mission.tagline}</p>
                        </div>
                      </div>
                      <p className="text-slate-700 mb-3">{mission.description}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                          {mission.toolkitName}
                        </span>
                        {isCompleted && (
                          <>
                            <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                              ✓ Complete
                            </span>
                            <span className="text-xs text-slate-600 font-medium">
                              {mission.achievement}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {isCurrentOrNext && !isCompleted && (
                      <div className="ml-4 text-blue-600 font-semibold text-sm flex-shrink-0">Start →</div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* My Solutions Display */}
        {enrollment && enrollment.toolkitItems.length > 0 && (
          <div className="mb-12 space-y-8">
            {/* Time You've Won Back */}
            <div className="p-8 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Time You've Won Back</h3>
              <div className="space-y-2 mb-6">
                {enrollment.toolkitItems.map((item) => {
                  const match = item.impact?.match(/(\d+)\s*hour|(\d+)\s*minute/g);
                  return (
                    <div key={item.missionId} className="flex justify-between items-center py-2 border-b border-purple-100">
                      <p className="font-medium text-slate-900">{item.toolkitName}</p>
                      <p className="text-slate-600">
                        {item.impact?.match(/(\d+\s*(?:hour|minute))/g)?.join(' ') || '—'}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between items-center pt-4 border-t-2 border-purple-300">
                <p className="text-lg font-bold text-slate-900">Total Every Week</p>
                <p className="text-lg font-bold text-purple-600">
                  {enrollment.toolkitItems.reduce((totalMinutes, item) => {
                    const minuteMatch = item.impact?.match(/(\d+)\s*minute/);
                    const hourMatch = item.impact?.match(/(\d+)\s*hour/);
                    const mins = minuteMatch ? parseInt(minuteMatch[1]) : 0;
                    const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
                    return totalMinutes + (hours * 60) + mins;
                  }, 0) > 0
                    ? (() => {
                        const totalMinutes = enrollment.toolkitItems.reduce((acc, item) => {
                          const minuteMatch = item.impact?.match(/(\d+)\s*minute/);
                          const hourMatch = item.impact?.match(/(\d+)\s*hour/);
                          const mins = minuteMatch ? parseInt(minuteMatch[1]) : 0;
                          const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
                          return acc + (hours * 60) + mins;
                        }, 0);
                        const h = Math.floor(totalMinutes / 60);
                        const m = totalMinutes % 60;
                        return `${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m` : ''}`.trim();
                      })()
                    : '0'}
                </p>
              </div>
            </div>

            {/* My Journey Timeline */}
            <div className="p-8 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">My Journey</h3>
              <div className="space-y-4">
                {enrollment.missionsCompleted >= 1 && (
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-purple-200">
                        <span className="text-purple-700 font-bold">✓</span>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Solved my first problem</p>
                      <p className="text-sm text-slate-600">
                        {new Date(enrollment.toolkitItems[0]?.completedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                )}

                {enrollment.missionsCompleted >= 2 && (
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-purple-200">
                        <span className="text-purple-700 font-bold">✓</span>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Built solutions for multiple areas</p>
                      <p className="text-sm text-slate-600">
                        Expanding beyond one problem
                      </p>
                    </div>
                  </div>
                )}

                {enrollment.missionsCompleted >= 3 && (
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-purple-200">
                        <span className="text-purple-700 font-bold">✓</span>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Won back hours every week</p>
                      <p className="text-sm text-slate-600">
                        Starting to see real impact on daily work
                      </p>
                    </div>
                  </div>
                )}

                {enrollment.missionsCompleted === course.missions.length && (
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-500">
                        <span className="text-white font-bold">✓</span>
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Became my own AI expert</p>
                      <p className="text-sm text-slate-600">
                        I can now solve any problem I face
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* My Transformations */}
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">My Solutions</h3>
                <p className="text-slate-600">The transformations I've created.</p>
              </div>
              {enrollment.toolkitItems.map((item, idx) => (
                <div key={item.missionId} className="bg-white rounded-lg p-6 border-2 border-blue-200">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-blue-100">
                        <span className="text-blue-600 font-bold">{idx + 1}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h4>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Problem Solved</p>
                          <p className="text-slate-700">{item.problemArea || 'General'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-600 uppercase mb-1">Time Won Back</p>
                          <p className="text-slate-700">{item.impact?.match(/(\d+ (?:hour|minute))/)?.[1] || '—'}</p>
                        </div>
                      </div>

                      {item.reflection && (
                        <div className="bg-slate-50 rounded p-3 mb-3">
                          <p className="text-xs font-semibold text-slate-600 mb-1">What Changed</p>
                          <p className="text-slate-700 italic">"{item.reflection}"</p>
                        </div>
                      )}

                      <p className="text-sm text-slate-600">
                        Solved on {new Date(item.completedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Journey Complete - The Success Moment */}
        {enrollment && enrollment.missionsCompleted === course.missions.length && (
          <div className="mt-12 p-8 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-3xl font-bold text-green-900 mb-4">You've Won Back Time</h3>
            <p className="text-lg text-green-800 mb-6">
              Five real problems solved. Countless hours reclaimed. And the knowledge that you can solve what's next.
            </p>

            {/* The Success Question */}
            <div className="bg-white rounded-lg p-8 mb-6 max-w-2xl mx-auto">
              <p className="text-slate-600 mb-4">One final question:</p>
              <p className="text-2xl font-bold text-slate-900 mb-6">
                Which problem disappears from your life tomorrow?
              </p>
              <textarea
                value={successAnswer}
                onChange={(e) => {
                  setSuccessAnswer(e.target.value);
                  setError(null);
                }}
                placeholder="Your answer..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-slate-900"
                rows={3}
              />
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
              <button
                onClick={handleSubmitSuccess}
                disabled={submittingSuccess}
                className="mt-4 w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingSuccess ? 'Submitting...' : 'Submit & Celebrate'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
