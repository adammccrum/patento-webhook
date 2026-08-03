/**
 * Choose a new password, having arrived from a reset email.
 */

'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@lao/ui';

export function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    // Checked here as well as on the server, so the mismatch is caught before
    // a round trip rather than counting against the rate limit.
    if (password !== confirm) {
      setError('The two passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error?.message || data.error || 'That did not work. Request a new link.');
        return;
      }

      setDone(true);
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Arriving with no token at all means the link was truncated by a mail
  // client. Say so, rather than showing a form that cannot succeed.
  if (token.length === 0) {
    return (
      <div className="space-y-4 text-center">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          This reset link is incomplete. It may have been cut short by your email app.
        </div>
        <a href="/auth/forgot-password" className="text-primary hover:underline font-medium text-sm">
          Request a new link
        </a>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          Your password has been changed.
        </div>
        <a href="/auth/login" className="text-primary hover:underline font-medium text-sm">
          Sign in
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          disabled={loading}
        />
      </div>

      <p className="text-sm text-slate-600">
        At least 12 characters. Avoid anything you use elsewhere.
      </p>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Saving...' : 'Change password'}
      </Button>
    </form>
  );
}
