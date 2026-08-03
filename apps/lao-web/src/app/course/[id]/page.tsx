'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { formatLastUsed } from '@/lib/solutions';

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

interface CourseSolution {
  id: string;
  name: string;
  problem: string;
  problemArea: string;
  currentVersion: number;
  useCount: number;
  lastUsedAt: string | null;
  originMissionId: string | null;
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
  const [solutions, setSolutions] = useState<CourseSolution[]>([]);
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
        setSolutions(data.solutions ?? []);
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
      setError('Please describe the problem');
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
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-red-600">{error || 'Course not found'}</div>
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
          <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900 py-1">
            Back to Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Course Header */}
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">{course.title}</h2>
          <p className="text-lg text-slate-700 mb-6">{course.description}</p>

          {enrollment && enrollment.missionsCompleted > 0 && (
            <p className="text-sm text-slate-600">
              {enrollment.missionsCompleted} of {course.missions.length} solved
            </p>
          )}
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

        {/* What this course built — living tools, not completed assignments */}
        {solutions.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-slate-900">What You Built</h3>
              <Link href="/solutions" className="text-sm text-slate-600 hover:text-slate-900 py-1">
                Your toolbox
              </Link>
            </div>
            <div className="space-y-3">
              {solutions.map((item) => (
                <Link key={item.id} href={`/solutions/${item.id}`}>
                  <div className="bg-white rounded-lg p-5 border border-slate-200 hover:border-slate-400 transition cursor-pointer">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{item.name}</p>
                          <span className="text-xs text-slate-500">v{item.currentVersion}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1 truncate">{item.problem}</p>
                      </div>
                      <span className="text-sm font-medium text-blue-600 whitespace-nowrap">Open</span>
                    </div>
                    <div className="flex items-center gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                      <span>
                        {item.useCount === 0
                          ? 'Not used yet'
                          : `Used ${item.useCount} time${item.useCount === 1 ? '' : 's'}`}
                      </span>
                      <span>Last used {formatLastUsed(item.lastUsedAt)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Course Complete */}
        {enrollment && enrollment.missionsCompleted === course.missions.length && (
          <div className="mt-12 p-6 bg-white border border-slate-200 rounded-lg">
            <p className="text-slate-900 font-medium mb-4">
              All {course.missions.length} solved. What problem should we tackle next?
            </p>
            <textarea
              value={successAnswer}
              onChange={(e) => {
                setSuccessAnswer(e.target.value);
                setError(null);
              }}
              placeholder="What's still costing you time?"
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              rows={2}
            />
            {error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            <button
              onClick={handleSubmitSuccess}
              disabled={submittingSuccess}
              className="mt-4 px-6 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition disabled:opacity-50"
            >
              {submittingSuccess ? 'Saving...' : 'Continue'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
