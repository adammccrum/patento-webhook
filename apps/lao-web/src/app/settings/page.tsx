'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    twoFactorEnabled: false,
    emailNotifications: true,
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-red-600">{error || 'Failed to load settings'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
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

            <div className="border-t border-slate-200 pt-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Appearance</h3>
              <div className="space-y-4">
                <label className="flex items-center p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                  <input
                    type="checkbox"
                    checked={formData.darkMode}
                    onChange={(e) =>
                      setFormData({ ...formData, darkMode: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-blue-600"
                  />
                  <div className="ml-3">
                    <p className="font-medium text-slate-900">Dark Mode</p>
                    <p className="text-sm text-slate-600">
                      Use dark theme (coming soon)
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
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Danger Zone</h3>
            <button className="px-4 py-2 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 transition">
              Delete Account
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
