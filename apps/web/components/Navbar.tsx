'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Music2, Ticket, PlaySquare, Shield, User, Radio } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-background/90 backdrop-blur-xl">
      <div className="relative mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8 py-3">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex size-10 items-center justify-center rounded-xl bg-polo-red text-white shadow-lg shadow-polo-red/20 group-hover:scale-105 transition-transform">
            <Radio className="size-5 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black tracking-wider uppercase leading-none">
              <span className="text-white">POLO</span>
              <span className="text-polo-red">STREAMING</span>
            </span>
            <span className="text-[10px] uppercase tracking-widest text-muted font-bold mt-1">
              Live Concerts · Global Broadcast
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-7">
          <Link
            href="/events"
            className={`text-sm font-semibold transition-colors hover:text-white ${
              pathname === '/events' ? 'text-polo-red' : 'text-muted'
            }`}
          >
            Live & Upcoming
          </Link>
          <Link
            href="/replays"
            className={`text-sm font-semibold transition-colors hover:text-white ${
              pathname === '/replays' ? 'text-polo-red' : 'text-muted'
            }`}
          >
            Replay Library
          </Link>
          <Link
            href="/dashboard"
            className={`text-sm font-semibold transition-colors hover:text-white ${
              pathname?.startsWith('/dashboard') ? 'text-polo-red' : 'text-muted'
            }`}
          >
            My Tickets
          </Link>
          <Link
            href="/admin"
            className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-line bg-surface hover:border-polo-red/40 hover:text-polo-red transition-all ${
              pathname?.startsWith('/admin') ? 'text-polo-red border-polo-red/50' : 'text-muted'
            }`}
          >
            <Shield className="size-3.5" />
            Admin Panel
          </Link>
        </nav>

        {/* User CTA */}
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-raised transition-colors"
          >
            <User className="size-4 text-polo-red" />
            <span className="hidden sm:inline">Viewer Account</span>
          </Link>

          <Link
            href="/events"
            className="inline-flex items-center gap-2 rounded-full bg-polo-red px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-polo-red/25 hover:bg-polo-red-dark active:scale-95 transition-all"
          >
            <Ticket className="size-4" />
            <span>Get Tickets</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
