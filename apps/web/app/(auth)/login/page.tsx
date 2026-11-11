'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, ArrowRight, Loader2, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@polostreaming.com');
  const [password, setPassword] = useState('Admin@1234');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign in');
      }

      if (data.user.roles.includes('SUPER_ADMIN') || data.user.roles.includes('EVENT_ADMIN')) {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-line bg-surface p-8 shadow-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-black uppercase tracking-tight text-white">Sign In</h2>
        <p className="text-xs text-muted mt-1">Access your concert tickets and live streaming access.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-950/60 border border-red-800 p-3 text-xs text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Email Address</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-xs text-white focus:border-polo-red focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-xs text-white focus:border-polo-red focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-full bg-polo-red hover:bg-polo-red-dark text-white font-bold text-xs uppercase tracking-wider transition-all shadow-xl shadow-polo-red/25 flex items-center justify-center gap-2 mt-6 active:scale-95 disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <span>Sign In</span>}
        </button>

        {/* Demo Fast Logins */}
        <div className="pt-4 border-t border-line/60 text-xs text-muted flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setEmail('admin@polostreaming.com');
              setPassword('Admin@1234');
            }}
            className="text-polo-red hover:underline"
          >
            Demo Admin Credentials
          </button>
          <button
            type="button"
            onClick={() => {
              setEmail('viewer@polostreaming.com');
              setPassword('Viewer@1234');
            }}
            className="text-neutral-400 hover:underline"
          >
            Demo Viewer
          </button>
        </div>
      </form>

      <div className="mt-6 text-center text-xs text-muted">
        Don't have an account?{' '}
        <Link href="/register" className="font-bold text-polo-red hover:underline">
          Register here
        </Link>
      </div>
    </div>
  );
}
