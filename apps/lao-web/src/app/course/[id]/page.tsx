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
  toolkitItems: Array<{ missionId: string; title: string; toolkitName: string; completedAt: string }>;
}

export default function CoursePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        {/* Toolkit Display */}
        {enrollment && enrollment.toolkitItems.length > 0 && (
          <div className="mb-12 p-8 bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-blue-200 rounded-lg">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">Your AI Toolkit</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {enrollment.toolkitItems.map((item) => (
                <div key={item.missionId} className="bg-white rounded-lg p-4 border border-blue-200">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">✓</span>
                    <div>
                      <p className="font-semibold text-slate-900">{item.toolkitName}</p>
                      <p className="text-xs text-slate-600">Built {new Date(item.completedAt).toLocaleDateString()}</p>
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
            <h3 className="text-3xl font-bold text-green-900 mb-4">Look What You've Built</h3>
            <p className="text-lg text-green-800 mb-6">
              Five working AI assistants. Real solutions to real problems. And the knowledge to build more.
            </p>

            {/* The Success Question */}
            <div className="bg-white rounded-lg p-8 mb-6 max-w-2xl mx-auto">
              <p className="text-slate-600 mb-4">One final question:</p>
              <p className="text-2xl font-bold text-slate-900 mb-6">
                Which assistant are you going to use tomorrow?
              </p>
              <textarea
                placeholder="Your answer..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-slate-900"
                rows={3}
              />
              <button className="mt-4 w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition">
                Submit & Celebrate
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
