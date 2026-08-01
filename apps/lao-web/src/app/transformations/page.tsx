'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function TransformationsPage() {
  const router = useRouter();

  // Example transformation stories - in production these come from database
  const transformations = [
    {
      id: '1',
      learner: 'Sarah M.',
      problem: 'Spent 2 hours daily processing emails',
      solution: 'Built an Email Assistant that triages and summarizes',
      outcome: 'Won back 10 hours every week',
      impact: 'Finally have time for creative work',
      date: '2024-12-15',
    },
    {
      id: '2',
      learner: 'James K.',
      problem: 'Sales reports took 3 days to analyze',
      solution: 'Created a Research Assistant to find patterns',
      outcome: 'Now complete reports in 2 hours',
      impact: 'Can focus on strategy instead of data entry',
      date: '2024-12-10',
    },
    {
      id: '3',
      learner: 'Maya P.',
      problem: 'Writing marketing copy was painfully slow',
      solution: 'Built a Content Assistant that drafts and adapts',
      outcome: 'Write 3x faster while keeping my voice',
      impact: 'Launched a side project I never had time for',
      date: '2024-12-08',
    },
    {
      id: '4',
      learner: 'David L.',
      problem: 'Repeating same tasks every day',
      solution: 'Created a Personal Assistant to automate workflows',
      outcome: 'Reclaimed 5 hours every week',
      impact: 'Got promoted because I could focus on bigger problems',
      date: '2024-12-05',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Navigation */}
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/dashboard">
            <h1 className="text-2xl font-bold text-slate-900 hover:text-slate-700 cursor-pointer">
              LAO
            </h1>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-slate-700 hover:text-slate-900 font-medium">
              Dashboard
            </Link>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition"
            >
              Back
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            How People Changed
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            These are real people who discovered they could solve problems with AI.
            Their transformations show what's possible.
          </p>
        </div>

        {/* Transformations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {transformations.map((story) => (
            <div
              key={story.id}
              className="bg-white rounded-lg border-2 border-blue-200 p-8 hover:shadow-lg transition"
            >
              {/* Learner Name */}
              <div className="mb-6">
                <p className="text-sm font-semibold text-blue-600 uppercase">Transformation</p>
                <h3 className="text-xl font-bold text-slate-900">{story.learner}</h3>
              </div>

              {/* The Journey */}
              <div className="space-y-4">
                <div className="border-l-4 border-red-300 pl-4">
                  <p className="text-xs font-semibold text-slate-600 uppercase">The Problem</p>
                  <p className="text-slate-700 font-medium">{story.problem}</p>
                </div>

                <div className="border-l-4 border-blue-300 pl-4">
                  <p className="text-xs font-semibold text-slate-600 uppercase">What They Built</p>
                  <p className="text-slate-700 font-medium">{story.solution}</p>
                </div>

                <div className="border-l-4 border-green-300 pl-4">
                  <p className="text-xs font-semibold text-slate-600 uppercase">The Outcome</p>
                  <p className="text-slate-700 font-bold text-lg">{story.outcome}</p>
                </div>

                <div className="bg-slate-50 rounded p-4 border-l-4 border-purple-300">
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-1">What Changed</p>
                  <p className="text-slate-700 italic">"{story.impact}"</p>
                </div>
              </div>

              <p className="text-xs text-slate-500 mt-6">
                {new Date(story.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-8 text-center">
          <h3 className="text-2xl font-bold text-slate-900 mb-3">
            Your transformation could be here
          </h3>
          <p className="text-slate-600 mb-6 max-w-2xl mx-auto">
            These aren't special people. They're ordinary people who took one hour to solve a real problem.
            That made them extraordinary.
          </p>
          <Link href="/course/1">
            <button className="px-8 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition">
              Start Your Transformation
            </button>
          </Link>
        </div>

        {/* Wall of Transformations Note */}
        <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-slate-700">
            <span className="font-semibold">This wall shows our real metric:</span> Not courses completed or features built, but real people whose lives changed because they solved a problem with AI.
          </p>
        </div>
      </main>
    </div>
  );
}
