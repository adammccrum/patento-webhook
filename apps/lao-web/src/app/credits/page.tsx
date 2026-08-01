'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CreditsPage() {
  const router = useRouter();
  const [creditsData, setCreditsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCredits() {
      try {
        const response = await fetch('/api/credits');
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/login');
            return;
          }
          throw new Error('Failed to fetch credits');
        }
        const data = await response.json();
        setCreditsData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchCredits();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (error || !creditsData) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-red-600">{error || 'Failed to load credits'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <nav className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900">LAO</h1>
          <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Credits & Usage</h2>
          <p className="text-slate-600">Monitor your credit balance and usage</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Credits Remaining</h3>
            <p className="text-4xl font-bold text-blue-600">{creditsData.remaining}</p>
            <p className="text-sm text-slate-500 mt-2">out of {creditsData.monthlyAllocation}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">This Month Usage</h3>
            <p className="text-4xl font-bold text-slate-900">{creditsData.spent}</p>
            <p className="text-sm text-slate-500 mt-2">{creditsData.percentUsed}% of allocation</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-semibold text-slate-600 mb-2">Account Balance</h3>
            <p className="text-4xl font-bold text-slate-900">{creditsData.balance}</p>
            <p className="text-sm text-slate-500 mt-2">from purchases</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Monthly Usage Progress</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-slate-600">Allocation Used</span>
                <span className="text-sm font-semibold text-slate-900">
                  {creditsData.percentUsed}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all"
                  style={{ width: `${creditsData.percentUsed}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{creditsData.spent}</p>
                <p className="text-xs text-slate-600 mt-1">Used</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{creditsData.remaining}</p>
                <p className="text-xs text-slate-600 mt-1">Remaining</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{creditsData.monthlyAllocation}</p>
                <p className="text-xs text-slate-600 mt-1">Monthly Limit</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Usage History</h3>
          <div className="space-y-3">
            {creditsData.usageHistory && creditsData.usageHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-4 font-semibold text-slate-900">Date</th>
                      <th className="text-left py-2 px-4 font-semibold text-slate-900">Action</th>
                      <th className="text-right py-2 px-4 font-semibold text-slate-900">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditsData.usageHistory.map((item: any) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="py-3 px-4 text-slate-600">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                            {item.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-slate-900 font-medium">
                          {item.details?.amount ? (
                            <span
                              className={
                                item.action === 'ai_usage'
                                  ? 'text-red-600'
                                  : 'text-green-600'
                              }
                            >
                              {item.action === 'ai_usage' ? '-' : '+'}
                              {item.details.amount}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-sm py-4">No usage history yet</p>
            )}
          </div>
        </div>

        <div className="mt-8 border border-hairline rounded-card p-6">
          <h3 className="font-medium text-ink mb-2">Need more credits?</h3>
          <p className="text-base leading-relaxed text-ink-body">
            There is nothing to buy during private beta. Your allocation resets
            each month, and if you run out before then, tell us — we will top you
            up and we would like to know what you were building.
          </p>
        </div>
      </main>
    </div>
  );
}
