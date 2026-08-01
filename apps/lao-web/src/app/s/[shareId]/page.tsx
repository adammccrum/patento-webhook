'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface SharedSolution {
  name: string;
  problem: string;
  problemArea: string;
  content: string;
  currentVersion: number;
  timeSavedMinutes: number;
}

export default function SharedSolutionPage() {
  const params = useParams();
  const shareId = params.shareId as string;

  const [solution, setSolution] = useState<SharedSolution | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/shared/${shareId}`);
        if (response.ok) {
          const data = await response.json();
          setSolution(data.solution);
        }
      } finally {
        setLoading(false);
      }
    }
    if (shareId) load();
  }, [shareId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!solution) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-slate-900 font-medium mb-2">This solution isn&apos;t available</p>
          <p className="text-sm text-slate-600">The link may have been withdrawn.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/">
            <h1 className="text-2xl font-bold text-slate-900">LAO</h1>
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">{solution.name}</h2>
          <p className="text-slate-600">Solves: {solution.problem}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-8">
          <pre className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap font-mono">
            {solution.content}
          </pre>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(solution.content);
                setCopied(true);
              } catch {
                /* clipboard unavailable */
              }
            }}
            className="mt-4 px-5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-6 text-center">
          <p className="text-slate-600 text-sm mb-4">
            Have a problem like this? Build your own solution.
          </p>
          <Link href="/auth/register">
            <button className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition text-sm font-medium">
              Get Started
            </button>
          </Link>
        </div>
      </main>
    </div>
  );
}
