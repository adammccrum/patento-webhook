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
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Community Solutions
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Real problems people solved. Maybe you have one.
          </p>
        </div>

        {/* Solutions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {transformations.map((story) => (
            <div
              key={story.id}
              className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow transition"
            >
              {/* The Problem */}
              <div className="mb-6">
                <p className="text-xs text-slate-600 font-semibold uppercase mb-2">Problem</p>
                <p className="text-slate-900 font-medium">{story.problem}</p>
              </div>

              {/* The Solution */}
              <div className="mb-6 p-4 bg-slate-50 rounded">
                <p className="text-xs text-slate-600 font-semibold uppercase mb-2">Solution</p>
                <p className="text-slate-700 text-sm">{story.solution}</p>
              </div>

              {/* The Result */}
              <div className="mb-4">
                <p className="text-xs text-slate-600 font-semibold uppercase mb-2">Result</p>
                <p className="text-slate-900 font-medium">{story.outcome}</p>
              </div>

              <p className="text-xs text-slate-500">
                {new Date(story.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center mt-12">
          <p className="text-slate-600 mb-6 max-w-2xl mx-auto">
            See a problem you have? Solve it.
          </p>
          <Link href="/course/1">
            <button className="px-8 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition">
              Build a Solution
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}
