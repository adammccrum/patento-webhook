'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatLastUsed, formatMinutes } from '@/lib/solutions';

interface SolutionSummary {
  id: string;
  name: string;
  problem: string;
  problemArea: string;
  currentVersion: number;
  useCount: number;
  lastUsedAt: string | null;
  timeSavedMinutes: number;
  totalTimeSavedMinutes: number;
  shareId: string | null;
  status: string;
}

export default function SolutionsPage() {
  const router = useRouter();
  const [solutions, setSolutions] = useState<SolutionSummary[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [areas, setAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [area, setArea] = useState('All');
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [sort, setSort] = useState<'recent' | 'name' | 'created'>('recent');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams({ status, sort });
        if (search.trim()) params.set('search', search.trim());
        if (area !== 'All') params.set('area', area);

        const response = await fetch(`/api/solutions?${params}`);
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/login');
            return;
          }
          throw new Error('Failed to load your toolbox');
        }
        const data = await response.json();
        if (cancelled) return;
        setSolutions(data.solutions);
        setSummary(data.summary);
        setAreas(data.areas ?? []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Debounce so typing in the search box doesn't fire a request per keystroke.
    const timer = setTimeout(load, search ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [router, search, area, status, sort]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/dashboard">
            <h1 className="text-2xl font-bold text-slate-900 hover:text-slate-700 cursor-pointer">LAO</h1>
          </Link>
          <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900 py-1">
            Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Your Toolbox</h2>
            {summary && summary.total > 0 && (
              <p className="text-sm text-slate-600 mt-1">
                {summary.inDailyUse} in use · {formatMinutes(summary.weeklyTimeSaved)} saved each week
              </p>
            )}
          </div>
          <Link href="/solutions/new">
            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium">
              New Solution
            </button>
          </Link>
        </div>

        {/* Find things once the toolbox grows */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your solutions"
            className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All areas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="recent">Recently used</option>
            <option value="name">Name</option>
            <option value="created">Newest</option>
          </select>
          <button
            onClick={() => setStatus(status === 'active' ? 'archived' : 'active')}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition"
          >
            {status === 'active'
              ? `Archived${summary?.archived ? ` (${summary.archived})` : ''}`
              : 'Back to active'}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {solutions.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
            {status === 'archived' ? (
              <p className="text-slate-900 font-medium">Nothing archived</p>
            ) : search || area !== 'All' ? (
              <p className="text-slate-900 font-medium">No solutions match that</p>
            ) : (
              <>
                <p className="text-slate-900 font-medium mb-2">Nothing in your toolbox yet</p>
                <p className="text-sm text-slate-600 mb-6">
                  Solve a problem and the tool you build lands here.
                </p>
                <Link href="/course/course-1">
                  <button className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium">
                    Solve a Problem
                  </button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {solutions.map((solution) => (
              <Link key={solution.id} href={`/solutions/${solution.id}`}>
                <div className="bg-white rounded-lg border border-slate-200 p-5 hover:border-slate-400 transition cursor-pointer">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-900">{solution.name}</p>
                        <span className="text-xs text-slate-500">v{solution.currentVersion}</span>
                        {solution.shareId && (
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                            Shared
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-1 truncate">{solution.problem}</p>
                    </div>
                    <span className="text-sm text-blue-600 font-medium whitespace-nowrap">Open</span>
                  </div>
                  <div className="flex items-center gap-4 pt-3 border-t border-slate-100 text-xs text-slate-600 flex-wrap">
                    <span>
                      {solution.useCount === 0
                        ? 'Not used yet'
                        : `Used ${solution.useCount} time${solution.useCount === 1 ? '' : 's'}`}
                    </span>
                    <span>Last used {formatLastUsed(solution.lastUsedAt)}</span>
                    {solution.totalTimeSavedMinutes > 0 && (
                      <span>{formatMinutes(solution.totalTimeSavedMinutes)} saved</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
