'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewSolutionPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [problem, setProblem] = useState('');
  const [problemArea, setProblemArea] = useState('General');
  const [content, setContent] = useState('');
  const [timeSavedMinutes, setTimeSavedMinutes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim() || !problem.trim() || !content.trim()) {
      setError('Give it a name, the problem it solves, and its content');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/solutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          problem,
          problemArea,
          content,
          timeSavedMinutes: Number.parseInt(timeSavedMinutes, 10) || 0,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create solution');
      }
      const data = await response.json();
      router.push(`/solutions/${data.solution.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/dashboard">
            <h1 className="text-2xl font-bold text-slate-900 hover:text-slate-700 cursor-pointer">LAO</h1>
          </Link>
          <Link href="/solutions" className="text-sm text-slate-600 hover:text-slate-900 py-1">
            Toolbox
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">New Solution</h2>

        <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-5">
          <div>
            <label htmlFor="solution-name" className="block text-sm font-semibold text-slate-900 mb-2">Name</label>
            <input
              id="solution-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Email Assistant"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="solution-problem" className="block text-sm font-semibold text-slate-900 mb-2">
              What problem does it solve?
            </label>
            <input
              id="solution-problem"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="Triaging my inbox every morning"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="solution-area" className="block text-sm font-semibold text-slate-900 mb-2">Area</label>
              <select
                id="solution-area"
                value={problemArea}
                onChange={(e) => setProblemArea(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {['General', 'Email', 'Writing', 'Analysis', 'Research', 'Admin'].map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="solution-minutes" className="block text-sm font-semibold text-slate-900 mb-2">
                Minutes saved per use
              </label>
              <input
                id="solution-minutes"
                value={timeSavedMinutes}
                onChange={(e) => setTimeSavedMinutes(e.target.value)}
                inputMode="numeric"
                placeholder="30"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="solution-content" className="block text-sm font-semibold text-slate-900 mb-2">The solution</label>
            <textarea
              id="solution-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="The instructions you give the AI."
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              rows={12}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={saving}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Add to Toolbox'}
          </button>
        </div>
      </main>
    </div>
  );
}
