'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Lesson {
  id: string;
  title: string;
  description: string;
  position: number;
  problemArea: string;
}

interface Course {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
}

interface Enrollment {
  currentLessonPosition: number;
  lessonsCompleted: number;
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

  const progressPercent = enrollment
    ? Math.round((enrollment.lessonsCompleted / course.lessons.length) * 100)
    : 0;

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
          <div className="text-sm text-slate-600">Building practical AI skills</div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Course Header */}
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">{course.title}</h2>
          <p className="text-lg text-slate-700 mb-6">{course.description}</p>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-sm text-slate-600 mt-2">
              Progress: {enrollment?.lessonsCompleted || 0} of {course.lessons.length} lessons complete
            </p>
          </div>
        </div>

        {/* Lessons Grid */}
        <div className="space-y-4">
          {course.lessons.map((lesson, idx) => {
            const isCompleted = enrollment && idx < enrollment.lessonsCompleted;
            const isCurrentOrNext =
              enrollment && (idx === enrollment.currentLessonPosition || idx <= enrollment.currentLessonPosition);
            const isLocked = enrollment && idx > enrollment.currentLessonPosition;

            return (
              <Link key={lesson.id} href={`/lesson/${lesson.id}`}>
                <div
                  className={`p-6 rounded-lg border-2 transition cursor-pointer ${
                    isLocked
                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                      : isCompleted
                        ? 'bg-green-50 border-green-200'
                        : isCurrentOrNext
                          ? 'bg-blue-50 border-blue-500'
                          : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            isCompleted
                              ? 'bg-green-500 text-white'
                              : isCurrentOrNext
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-300 text-slate-600'
                          }`}
                        >
                          {isCompleted ? '✓' : lesson.position}
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">{lesson.title}</h3>
                      </div>
                      <p className="text-slate-700 mb-2">{lesson.description}</p>
                      <div className="flex items-center gap-3">
                        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                          {lesson.problemArea}
                        </span>
                        {isCompleted && (
                          <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                            Completed
                          </span>
                        )}
                      </div>
                    </div>
                    {isCurrentOrNext && !isCompleted && (
                      <div className="ml-4 text-blue-600 font-semibold">Start →</div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Course Completion Message */}
        {enrollment && enrollment.lessonsCompleted === course.lessons.length && (
          <div className="mt-12 p-8 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-2xl font-bold text-green-900 mb-2">Course Complete!</h3>
            <p className="text-green-800">You've built practical AI skills across multiple use cases.</p>
            <p className="text-sm text-green-700 mt-4">Your portfolio now showcases real solutions to real problems.</p>
          </div>
        )}
      </main>
    </div>
  );
}
