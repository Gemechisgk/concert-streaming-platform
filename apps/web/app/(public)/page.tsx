import Link from 'next/link';
import { EventService } from '@concert/business-logic';
import EventCard from '@/components/EventCard';
import { Play, Ticket, ShieldCheck, Zap, Radio, Sparkles, Smartphone, BellRing, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@concert/shared';

export default function HomePage() {
  const allEvents = EventService.getEvents();
  const liveEvent = allEvents.find(e => e.status === 'LIVE') || allEvents[0];
  const upcomingEvents = allEvents.filter(e => e.status !== 'LIVE');

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden border-b border-line">
        {/* Background Backdrop Image */}
        <div className="absolute inset-0 z-0">
          <img
            src={liveEvent.bannerImage}
            alt={liveEvent.title}
            className="size-full object-cover object-center filter brightness-40 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8 py-20 w-full">
          <div className="max-w-2xl">
            {/* Live Indicator */}
            {liveEvent.status === 'LIVE' ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-polo-red/20 border border-polo-red px-3.5 py-1 text-xs font-black uppercase tracking-wider text-polo-red mb-6 animate-live-badge">
                <span className="size-2 rounded-full bg-polo-red animate-ping" />
                <span>Broadcasting Live Now</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full bg-surface-raised border border-line px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-neutral-300 mb-6">
                <Sparkles className="size-3.5 text-polo-red" />
                <span>Featured Live Experience</span>
              </div>
            )}

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white uppercase leading-[1.05]">
              {liveEvent.title}
            </h1>

            <p className="mt-4 text-base sm:text-lg text-neutral-300 leading-relaxed max-w-xl">
              {liveEvent.tagline}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {liveEvent.status === 'LIVE' ? (
                <Link
                  href={`/watch/${liveEvent.id}`}
                  className="inline-flex items-center gap-2.5 rounded-full bg-polo-red px-7 py-3.5 text-sm font-extrabold uppercase tracking-wider text-white shadow-xl shadow-polo-red/30 hover:bg-polo-red-dark active:scale-95 transition-all"
                >
                  <Play className="size-4 fill-white" />
                  <span>Enter Live Stream</span>
                </Link>
              ) : null}

              <Link
                href={`/events/${liveEvent.slug}`}
                className="inline-flex items-center gap-2.5 rounded-full bg-surface-raised border border-line hover:border-polo-red px-7 py-3.5 text-sm font-bold text-white hover:bg-white/10 active:scale-95 transition-all"
              >
                <Ticket className="size-4 text-polo-red" />
                <span>Get Tickets</span>
              </Link>
            </div>

            {/* Quick Stats Banner */}
            <div className="mt-12 grid grid-cols-3 gap-6 pt-8 border-t border-line/60 max-w-lg">
              <div>
                <span className="block text-2xl font-black text-white">50K+</span>
                <span className="text-xs text-muted uppercase font-bold tracking-wider">Live Capacity</span>
              </div>
              <div>
                <span className="block text-2xl font-black text-polo-red">1080p60</span>
                <span className="text-xs text-muted uppercase font-bold tracking-wider">Studio Audio</span>
              </div>
              <div>
                <span className="block text-2xl font-black text-white">&lt;2s</span>
                <span className="text-xs text-muted uppercase font-bold tracking-wider">Ultra Latency</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Now Spotlight section */}
      {liveEvent.status === 'LIVE' && (
        <section className="mx-auto max-w-7xl px-5 sm:px-8 py-16">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <span className="size-3 rounded-full bg-polo-red animate-ping" />
              <h2 className="text-2xl font-black uppercase tracking-tight text-white">
                Live Now On Stage
              </h2>
            </div>
            <Link
              href={`/watch/${liveEvent.id}`}
              className="text-xs font-bold text-polo-red hover:underline flex items-center gap-1"
            >
              Watch Broadcast <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="relative rounded-3xl border border-line bg-surface overflow-hidden grid grid-cols-1 lg:grid-cols-12 shadow-2xl">
            <div className="lg:col-span-7 relative aspect-video bg-black">
              <img
                src={liveEvent.bannerImage}
                alt={liveEvent.title}
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Link
                  href={`/watch/${liveEvent.id}`}
                  className="flex size-16 items-center justify-center rounded-full bg-polo-red text-white shadow-2xl hover:scale-110 active:scale-95 transition-transform"
                >
                  <Play className="size-7 fill-white ml-1" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5 p-8 flex flex-col justify-between">
              <div>
                <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-polo-red/20 text-polo-red border border-polo-red/40">
                  Millennium Hall · Addis Ababa
                </span>
                <h3 className="text-2xl font-black text-white mt-4">{liveEvent.title}</h3>
                <p className="mt-2 text-xs text-muted leading-relaxed">{liveEvent.description}</p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {liveEvent.artists.map(a => (
                    <span key={a.id} className="text-xs font-bold px-3 py-1 rounded-lg bg-surface-raised border border-line text-white">
                      {a.name} ({a.role})
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-line flex items-center justify-between">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-muted">Passes from</span>
                  <span className="text-lg font-black text-white">ETB 250.00</span>
                </div>
                <Link
                  href={`/watch/${liveEvent.id}`}
                  className="rounded-full bg-polo-red px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-polo-red-dark transition-all"
                >
                  Join Live Stream
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Upcoming Concerts Grid */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">
              Upcoming Concerts & Tours
            </h2>
            <p className="text-xs text-muted mt-1">Book your digital passes early before inventory sells out.</p>
          </div>
          <Link
            href="/events"
            className="text-xs font-bold text-polo-red hover:underline flex items-center gap-1"
          >
            View All Concerts <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {upcomingEvents.map(event => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </section>

      {/* How it Works Section (Polostreaming UI 3-step guide) */}
      <section className="border-y border-line bg-surface/40 py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="text-center max-w-xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-polo-red">Effortless Digital Access</span>
            <h2 className="text-3xl font-black uppercase tracking-tight text-white mt-1">
              How Live Streaming Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex gap-4 rounded-2xl border border-line p-6 bg-surface">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-polo-red/30 bg-polo-red/10 text-polo-red font-black text-lg">
                01
              </span>
              <div>
                <h3 className="text-base font-extrabold text-white">Get your ticket</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  Choose your pass tier: Standard HD, VIP Backstage, or Replay VOD pass.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-2xl border border-line p-6 bg-surface">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-polo-red/30 bg-polo-red/10 text-polo-red font-black text-lg">
                02
              </span>
              <div>
                <h3 className="text-base font-extrabold text-white">Pay Instantly</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  Pay securely with Telebirr, CBE Birr, Chapa, Arifpay or international credit cards.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-2xl border border-line p-6 bg-surface">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-polo-red/30 bg-polo-red/10 text-polo-red font-black text-lg">
                03
              </span>
              <div>
                <h3 className="text-base font-extrabold text-white">Watch in Studio HD</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  Receive your unique digital ticket pass and enjoy real-time chat, virtual gifts, and stadium audio.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Artists Showcase */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8 py-20">
        <div className="mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-polo-red">Legendary Performers</span>
          <h2 className="text-3xl font-black uppercase tracking-tight text-white mt-1">
            Featured Concert Artists
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {allEvents.flatMap(e => e.artists).slice(0, 3).map((artist) => (
            <div key={artist.id} className="group rounded-2xl border border-line bg-surface overflow-hidden p-5 flex items-center gap-4 hover:border-polo-red/50 transition-all">
              <img
                src={artist.imageUrl}
                alt={artist.name}
                className="size-20 rounded-xl object-cover shrink-0 group-hover:scale-105 transition-transform"
              />
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-polo-red">{artist.role}</span>
                <h4 className="text-base font-extrabold text-white truncate">{artist.name}</h4>
                <p className="text-xs text-muted line-clamp-2 mt-1">{artist.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
