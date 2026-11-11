'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phoneNumber })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-line bg-surface p-8 shadow-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-black uppercase tracking-tight text-white">Create Account</h2>
        <p className="text-xs text-muted mt-1">Join the concert stream with exclusive attendee perks.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-950/60 border border-red-800 p-3 text-xs text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Full Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-xs text-white focus:border-polo-red focus:outline-none"
          />
        </div>

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
          <label className="block text-xs font-bold text-muted mb-1.5">Mobile Phone (optional)</label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={e => setPhoneNumber(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-xs text-white focus:border-polo-red focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Password</label>
          <input
            type="password"
            required
            minLength={8}
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
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <span>Register & Continue</span>}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-bold text-polo-red hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
