'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Ticket,
  PlaySquare,
  Shield,
  User,
  Radio,
  ArrowLeft,
  Calendar,
  Sparkles
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const isWatchRoom = pathname?.startsWith('/watch');

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-background/95 backdrop-blur-xl">
        <div className="relative mx-auto flex h-14 sm:h-18 max-w-7xl items-center justify-between px-3 sm:px-8 py-2 sm:py-3">
          {/* Watch Room Header Mode */}
          {isWatchRoom ? (
            <div className="flex items-center justify-between w-full">
              <Link
                href="/events"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface-raised border border-line text-xs font-bold text-neutral-300 hover:text-white hover:border-polo-red transition-all"
              >
                <ArrowLeft className="size-3.5 text-polo-red" />
                <span className="hidden xs:inline">Concerts</span>
              </Link>

              <div className="flex items-center gap-2">
                <div className="flex size-7 sm:size-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 via-rose-600 to-polo-red text-white shadow-md">
                  <Radio className="size-3.5 sm:size-4 animate-pulse" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm sm:text-base font-black tracking-wider uppercase">
                    FESHTA<span className="text-polo-red ml-1">FEST</span>
                  </span>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-polo-red/20 border border-polo-red text-[9px] font-black uppercase text-polo-red animate-pulse">
                    LIVE
                  </span>
                </div>
              </div>

              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-bold text-neutral-200 hover:text-white"
              >
                <User className="size-3.5 text-polo-red" />
                <span className="hidden sm:inline">Pass Holder</span>
              </Link>
            </div>
          ) : (
            /* Standard Platform Header */
            <>
              {/* Brand Logo */}
              <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
                <div className="flex size-8 sm:size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 via-rose-600 to-polo-red text-white shadow-lg shadow-polo-red/30 group-hover:scale-105 transition-transform shrink-0">
                  <Radio className="size-4 sm:size-5 animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <span className="text-base sm:text-lg font-black tracking-wider uppercase leading-none">
                    <span className="text-white">FESHTA</span>
                    <span className="text-polo-red ml-1">FEST</span>
                  </span>
                  <span className="text-[9px] sm:text-[10px] uppercase tracking-widest text-muted font-bold mt-0.5 hidden xs:block">
                    Live Concerts · Festival Broadcast
                  </span>
                </div>
              </Link>

              {/* Desktop Navigation Links */}
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
                  Admin
                </Link>
              </nav>

              {/* User CTA */}
              <div className="flex items-center gap-2 sm:gap-3">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-foreground hover:bg-surface-raised transition-colors"
                >
                  <User className="size-3.5 sm:size-4 text-polo-red" />
                  <span className="hidden sm:inline">Account</span>
                </Link>

                <Link
                  href="/events"
                  className="inline-flex items-center gap-1.5 rounded-full bg-polo-red px-3.5 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white shadow-lg shadow-polo-red/25 hover:bg-polo-red-dark active:scale-95 transition-all shrink-0"
                >
                  <Ticket className="size-3.5 sm:size-4" />
                  <span>Get Tickets</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Non-watch pages) */}
      {!isWatchRoom && (
        <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-surface/95 border-t border-line backdrop-blur-xl px-4 py-2 flex items-center justify-around safe-area-pb">
          <Link
            href="/events"
            className={`flex flex-col items-center gap-1 py-1 text-[10px] font-bold ${
              pathname === '/events' ? 'text-polo-red' : 'text-muted hover:text-white'
            }`}
          >
            <Radio className="size-4" />
            <span>Concerts</span>
          </Link>
          <Link
            href="/replays"
            className={`flex flex-col items-center gap-1 py-1 text-[10px] font-bold ${
              pathname === '/replays' ? 'text-polo-red' : 'text-muted hover:text-white'
            }`}
          >
            <PlaySquare className="size-4" />
            <span>Replays</span>
          </Link>
          <Link
            href="/dashboard"
            className={`flex flex-col items-center gap-1 py-1 text-[10px] font-bold ${
              pathname?.startsWith('/dashboard') ? 'text-polo-red' : 'text-muted hover:text-white'
            }`}
          >
            <Ticket className="size-4" />
            <span>Tickets</span>
          </Link>
          <Link
            href="/admin"
            className={`flex flex-col items-center gap-1 py-1 text-[10px] font-bold ${
              pathname?.startsWith('/admin') ? 'text-polo-red' : 'text-muted hover:text-white'
            }`}
          >
            <Shield className="size-4" />
            <span>Admin</span>
          </Link>
        </nav>
      )}
    </>
  );
}
