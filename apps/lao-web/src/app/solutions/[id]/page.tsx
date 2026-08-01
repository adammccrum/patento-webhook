'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatLastUsed, formatMinutes, type CollaboratorPrompt } from '@/lib/solutions';

interface SolutionVersion {
  id: string;
  version: number;
  content: string;
  changeNote: string | null;
  createdAt: string;
}

interface SolutionRun {
  id: string;
  version: number;
  timeSavedMinutes: number | null;
  note: string | null;
  ranAt: string;
}

interface Solution {
  id: string;
  name: string;
  problem: string;
  problemArea: string;
  content: string;
  notes: string | null;
  currentVersion: number;
  useCount: number;
  lastUsedAt: string | null;
  timeSavedMinutes: number;
  totalTimeSavedMinutes: number;
  shareId: string | null;
  status: string;
  createdAt: string;
  versions: SolutionVersion[];
  runs: SolutionRun[];
}

export default function SolutionWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const solutionId = params.id as string;

  const [solution, setSolution] = useState<Solution | null>(null);
  const [collaborator, setCollaborator] = useState<CollaboratorPrompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Improving
  const [improving, setImproving] = useState(false);
  const [draft, setDraft] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Renaming
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  // Notes
  const [notesDraft, setNotesDraft] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/solutions/${solutionId}`);
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login');
          return;
        }
        throw new Error('Failed to load this solution');
      }
      const data = await response.json();
      setSolution(data.solution);
      setCollaborator(data.collaborator);
      setNotesDraft(data.solution.notes ?? '');
      setNameDraft(data.solution.name);
      setNotesDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [solutionId, router]);

  useEffect(() => {
    if (solutionId) load();
  }, [solutionId, load]);

  /** Copy the tool and record that it was genuinely used. */
  const handleUse = async () => {
    if (!solution) return;
    try {
      await navigator.clipboard.writeText(solution.content);
      setStatus('Copied. Marked as used.');
    } catch {
      setStatus('Marked as used.');
    }

    try {
      const response = await fetch(`/api/solutions/${solutionId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to record use');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleSaveImprovement = async () => {
    if (!draft.trim()) {
      setError('The solution cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/solutions/${solutionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft, changeNote }),
      });
      if (!response.ok) throw new Error('Failed to save');
      const data = await response.json();
      setImproving(false);
      setChangeNote('');
      setStatus(data.versioned ? `Saved as v${data.solution.currentVersion}.` : 'No changes to save.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const patch = async (body: Record<string, unknown>, message: string) => {
    try {
      const response = await fetch(`/api/solutions/${solutionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Failed to save');
      setStatus(message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleDuplicate = async () => {
    try {
      const response = await fetch(`/api/solutions/${solutionId}/duplicate`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to duplicate');
      const data = await response.json();
      router.push(`/solutions/${data.solution.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleShare = async () => {
    if (!solution) return;
    try {
      const response = await fetch(`/api/solutions/${solutionId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shared: !solution.shareId }),
      });
      if (!response.ok) throw new Error('Failed to update sharing');
      const data = await response.json();
      if (data.shareUrl) {
        const url = `${window.location.origin}${data.shareUrl}`;
        try {
          await navigator.clipboard.writeText(url);
          setStatus('Share link copied.');
        } catch {
          setStatus(`Shared at ${url}`);
        }
      } else {
        setStatus('Sharing turned off.');
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  /** Deleting destroys version history, so it takes two clicks. */
  const handleDelete = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      setStatus(null);
      return;
    }
    try {
      const response = await fetch(`/api/solutions/${solutionId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      router.push('/solutions');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setConfirmingDelete(false);
    }
  };

  const handleRestore = async (version: number) => {
    try {
      const response = await fetch(
        `/api/solutions/${solutionId}/versions/${version}/restore`,
        { method: 'POST' }
      );
      if (!response.ok) throw new Error('Failed to restore');
      const data = await response.json();
      setStatus(
        data.restored ? `v${version} restored as v${data.solution.currentVersion}.` : 'Already current.'
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!solution) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-red-600">{error || 'Solution not found'}</div>
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
          <Link href="/solutions" className="text-sm text-slate-600 hover:text-slate-900">
            Toolbox
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Identity */}
        <div className="mb-6">
          {renaming ? (
            <div className="flex gap-2 items-center mb-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="text-2xl font-bold text-slate-900 px-3 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1"
                autoFocus
              />
              <button
                onClick={async () => {
                  await patch({ name: nameDraft }, 'Renamed.');
                  setRenaming(false);
                }}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm font-medium hover:bg-blue-600"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setNameDraft(solution.name);
                  setRenaming(false);
                }}
                className="px-3 py-1 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h2 className="text-2xl font-bold text-slate-900">{solution.name}</h2>
              <span className="text-sm text-slate-500">v{solution.currentVersion}</span>
              <button
                onClick={() => setRenaming(true)}
                className="text-xs text-slate-600 hover:text-slate-900 underline"
              >
                Rename
              </button>
            </div>
          )}
          <p className="text-slate-600">{solution.problem}</p>
        </div>

        {/* What we've noticed */}
        {collaborator && (
          <div className="mb-6 p-4 bg-white border border-slate-200 rounded-lg">
            <p className="text-sm text-slate-900">{collaborator.observation}</p>
            <div className="flex items-center justify-between gap-4 mt-1 flex-wrap">
              <p className="text-sm text-slate-600">{collaborator.question}</p>
              {!improving && (
                <button
                  onClick={() => {
                    setDraft(solution.content);
                    setImproving(true);
                  }}
                  className="text-sm text-blue-600 font-medium hover:underline whitespace-nowrap"
                >
                  Improve it
                </button>
              )}
            </div>
          </div>
        )}

        {status && (
          <div className="mb-4 p-3 bg-slate-100 border border-slate-200 rounded-lg">
            <p className="text-sm text-slate-700">{status}</p>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* The tool itself */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4 gap-4">
                <h3 className="font-semibold text-slate-900">
                  {improving ? `Improving — will save as v${solution.currentVersion + 1}` : 'The solution'}
                </h3>
                {!improving && (
                  <button
                    onClick={() => {
                      setDraft(solution.content);
                      setImproving(true);
                    }}
                    className="text-sm text-slate-600 hover:text-slate-900 underline"
                  >
                    Improve
                  </button>
                )}
              </div>

              {improving ? (
                <>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={16}
                  />
                  <input
                    value={changeNote}
                    onChange={(e) => setChangeNote(e.target.value)}
                    placeholder="What did you change? (optional)"
                    className="w-full mt-3 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={handleSaveImprovement}
                      disabled={saving}
                      className="px-5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save New Version'}
                    </button>
                    <button
                      onClick={() => {
                        setImproving(false);
                        setChangeNote('');
                        setError(null);
                      }}
                      className="px-5 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <pre className="text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap font-mono">
                    {solution.content}
                  </pre>
                  <button
                    onClick={handleUse}
                    className="mt-4 px-5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium"
                  >
                    Copy &amp; Use
                  </button>
                  <p className="text-xs text-slate-500 mt-2">
                    Copies the solution and records that you used it today.
                  </p>
                </>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-3">Notes</h3>
              <textarea
                value={notesDraft}
                onChange={(e) => {
                  setNotesDraft(e.target.value);
                  setNotesDirty(true);
                }}
                placeholder="How you use this, what to watch for, ideas for next time."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                rows={4}
              />
              {notesDirty && (
                <button
                  onClick={async () => {
                    await patch({ notes: notesDraft }, 'Notes saved.');
                  }}
                  className="mt-3 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition text-sm font-medium"
                >
                  Save Notes
                </button>
              )}
            </div>

            {/* History */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between"
              >
                <h3 className="font-semibold text-slate-900">
                  History — {solution.versions.length} version
                  {solution.versions.length === 1 ? '' : 's'}
                </h3>
                <span className="text-sm text-slate-500">{showHistory ? 'Hide' : 'Show'}</span>
              </button>

              {showHistory && (
                <div className="mt-4 space-y-3">
                  {solution.versions.map((version) => (
                    <div
                      key={version.id}
                      className="flex items-start justify-between gap-4 py-3 border-t border-slate-100"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">v{version.version}</span>
                          {version.version === solution.currentVersion && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mt-0.5">
                          {version.changeNote || 'Updated'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(version.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {version.version !== solution.currentVersion && (
                        <button
                          onClick={() => handleRestore(version.version)}
                          className="text-sm text-blue-600 hover:underline whitespace-nowrap"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Usage</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-600">Times used</dt>
                  <dd className="text-slate-900 font-medium">{solution.useCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Last used</dt>
                  <dd className="text-slate-900 font-medium">
                    {formatLastUsed(solution.lastUsedAt)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Saved so far</dt>
                  <dd className="text-slate-900 font-medium">
                    {formatMinutes(solution.totalTimeSavedMinutes)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Area</dt>
                  <dd className="text-slate-900 font-medium">{solution.problemArea}</dd>
                </div>
              </dl>
            </div>

            {solution.runs.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-900 mb-3">Recent uses</h3>
                <ul className="space-y-2 text-sm">
                  {solution.runs.slice(0, 5).map((run) => (
                    <li key={run.id} className="flex justify-between text-slate-600">
                      <span>{new Date(run.ranAt).toLocaleDateString()}</span>
                      <span className="text-slate-500">v{run.version}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-3">Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={handleDuplicate}
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-slate-700 text-sm transition"
                >
                  Duplicate
                </button>
                <button
                  onClick={handleShare}
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-slate-700 text-sm transition"
                >
                  {solution.shareId ? 'Stop sharing' : 'Share'}
                </button>
                <button
                  onClick={() =>
                    patch(
                      { status: solution.status === 'archived' ? 'active' : 'archived' },
                      solution.status === 'archived' ? 'Restored to toolbox.' : 'Archived.'
                    )
                  }
                  className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 text-slate-700 text-sm transition"
                >
                  {solution.status === 'archived' ? 'Restore to toolbox' : 'Archive'}
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-3 py-2 rounded hover:bg-red-50 text-red-700 text-sm transition"
                >
                  {confirmingDelete ? 'Click again to confirm' : 'Delete'}
                </button>
                {confirmingDelete && (
                  <p className="px-3 text-xs text-slate-600">
                    This removes the solution and all {solution.versions.length} version
                    {solution.versions.length === 1 ? '' : 's'} permanently. Archiving keeps it.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
