'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    twoFactorEnabled: false,
    emailNotifications: true,
    // Deprecated. LAO's identity is a clean, bright workspace, so there is
    // no dark theme and no toggle. Kept in state only so saving settings does
    // not clear the stored column. See /brand/AUDIT.md A12.
    darkMode: false,
    emailOnLogin: false,
    emailOnSecurityAlert: true,
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/settings');
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/login');
            return;
          }
          throw new Error('Failed to fetch settings');
        }
        const data = await response.json();
        setSettings(data);
        setFormData({
          twoFactorEnabled: data.twoFactorEnabled || false,
          emailNotifications: data.emailNotifications !== false,
          darkMode: data.darkMode || false,
          emailOnLogin: data.emailOnLogin || false,
          emailOnSecurityAlert: data.emailOnSecurityAlert !== false,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      const data = await response.json();
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-red-600">{error || 'Failed to load settings'}</div>
      </div>
    );
  }

  async function handleDeleteAccount() {
    setDeleteError(null);
    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not delete the account');

      // The session belongs to an account that no longer exists.
      await fetch('/api/auth/signout', { method: 'POST' }).catch(() => {});
      router.push('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'An error occurred');
    }
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

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-8">Settings</h2>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Security</h3>
              <div className="space-y-4">
                <label className="flex items-center p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    checked={formData.twoFactorEnabled}
                    onChange={(e) =>
                      setFormData({ ...formData, twoFactorEnabled: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <div className="ml-3">
                    <p className="font-medium text-slate-900">Two-Factor Authentication</p>
                    <p className="text-sm text-slate-600">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                </label>

                <label className="flex items-center p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    checked={formData.emailOnSecurityAlert}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        emailOnSecurityAlert: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <div className="ml-3">
                    <p className="font-medium text-slate-900">Security Alerts</p>
                    <p className="text-sm text-slate-600">
                      Get notified of suspicious account activity
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Notifications</h3>
              <div className="space-y-4">
                <label className="flex items-center p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    checked={formData.emailNotifications}
                    onChange={(e) =>
                      setFormData({ ...formData, emailNotifications: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <div className="ml-3">
                    <p className="font-medium text-slate-900">Email Notifications</p>
                    <p className="text-sm text-slate-600">
                      Receive emails about your learning progress
                    </p>
                  </div>
                </label>

                <label className="flex items-center p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    checked={formData.emailOnLogin}
                    onChange={(e) =>
                      setFormData({ ...formData, emailOnLogin: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <div className="ml-3">
                    <p className="font-medium text-slate-900">Login Notifications</p>
                    <p className="text-sm text-slate-600">
                      Be notified when your account is accessed
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-200">
            <h3 className="text-lg font-semibold text-ink mb-2">Your data</h3>
            <p className="text-sm text-ink-muted mb-4">
              Your solutions are yours. Take them with you at any time, or remove
              everything permanently.
            </p>

            <a
              href="/api/account/export"
              className="inline-flex items-center gap-2 px-4 py-2 border border-hairline-strong rounded-control text-ink text-sm font-medium hover:bg-surface-sunken transition"
            >
              <Download size={18} strokeWidth={1.5} aria-hidden />
              Download my data
            </a>

            <div className="mt-8 pt-6 border-t border-hairline">
              <h4 className="font-medium text-ink mb-2">Delete my account</h4>
              <p className="text-sm text-ink-muted mb-4">
                This removes your account, every solution, every version you saved,
                and every conversation. It cannot be undone.
              </p>

              {!deleting ? (
                <button
                  type="button"
                  onClick={() => setDeleting(true)}
                  className="px-4 py-2 border border-red-300 text-danger rounded-control text-sm font-medium hover:bg-red-50 transition"
                >
                  Delete my account
                </button>
              ) : (
                <div className="space-y-3 max-w-md">
                  <label htmlFor="confirm-email" className="block text-sm text-ink">
                    Type your email address to confirm
                  </label>
                  <input
                    id="confirm-email"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder="your email address"
                    className="w-full px-3 py-2 border border-hairline-strong rounded-control text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
                  />
                  {deleteError && <p className="text-sm text-danger">{deleteError}</p>}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      className="px-4 py-2 bg-danger text-white rounded-control text-sm font-medium hover:opacity-90 transition"
                    >
                      Delete permanently
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleting(false);
                        setConfirmEmail('');
                        setDeleteError(null);
                      }}
                      className="px-4 py-2 border border-hairline-strong text-ink rounded-control text-sm hover:bg-surface-sunken transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
