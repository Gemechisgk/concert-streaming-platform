import { notFound } from 'next/navigation';
import Link from 'next/link';
import { EventService, TicketService } from '@concert/business-logic';
import { formatConcertDate, formatConcertTime, formatCurrency } from '@concert/shared';
import { Calendar, MapPin, Ticket, ShieldCheck, Check, Clock, Radio, Play, Sparkles } from 'lucide-react';

export default async function EventDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = EventService.getEventBySlug(slug);

  if (!event) {
    notFound();
  }

  const ticketTypes = TicketService.getTicketTypesForEvent(event.id);
  const isLive = event.status === 'LIVE';

  return (
    <div className="relative pb-24">
      {/* Event Hero Banner */}
      <section className="relative min-h-[50vh] flex items-end overflow-hidden border-b border-line">
        <div className="absolute inset-0 z-0">
          <img
            src={event.bannerImage}
            alt={event.title}
            className="size-full object-cover filter brightness-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8 py-12 w-full">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {isLive ? (
              <span className="flex items-center gap-1.5 rounded-full bg-polo-red px-3 py-1 text-xs font-black uppercase text-white shadow-lg animate-live-badge">
                <span className="size-2 rounded-full bg-white animate-ping" />
                BROADCASTING LIVE
              </span>
            ) : (
              <span className="rounded-full bg-surface-raised border border-line px-3 py-1 text-xs font-bold text-neutral-300">
                {event.status}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300">
              <MapPin className="size-3.5 text-polo-red" />
              {event.venueName}, {event.venueCity}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white max-w-3xl leading-tight">
            {event.title}
          </h1>

          <p className="mt-3 text-sm sm:text-base text-neutral-300 max-w-2xl leading-relaxed">
            {event.tagline}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-semibold text-neutral-300">
            <span className="flex items-center gap-1.5 bg-surface/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-line">
              <Calendar className="size-3.5 text-polo-red" />
              {formatConcertDate(event.startTime)}
            </span>
            <span className="flex items-center gap-1.5 bg-surface/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-line">
              <Clock className="size-3.5 text-polo-red" />
              {formatConcertTime(event.startTime)}
            </span>

            {isLive && (
              <Link
                href={`/watch/${event.id}`}
                className="flex items-center gap-2 rounded-full bg-polo-red px-5 py-2 text-xs font-bold text-white hover:bg-polo-red-dark transition-all shadow-lg"
              >
                <Play className="size-3.5 fill-white" />
                Join Live Broadcast
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Main Grid: Details + Ticket Passes */}
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Description, Artists, Schedule */}
          <div className="lg:col-span-7 space-y-12">
            {/* About Concert */}
            <section>
              <h2 className="text-xl font-black uppercase tracking-tight text-white mb-4">
                About The Concert
              </h2>
              <div className="rounded-2xl border border-line bg-surface p-6">
                <p className="text-sm leading-relaxed text-neutral-300 whitespace-pre-line">
                  {event.description}
                </p>

                <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 border-t border-line text-xs">
                  <div>
                    <span className="block text-muted text-[10px] uppercase font-bold">Sound Quality</span>
                    <span className="font-bold text-white">Lossless Studio AAC</span>
                  </div>
                  <div>
                    <span className="block text-muted text-[10px] uppercase font-bold">Video Feed</span>
                    <span className="font-bold text-white">1080p60 Adaptive Bitrate</span>
                  </div>
                  <div>
                    <span className="block text-muted text-[10px] uppercase font-bold">Latency Target</span>
                    <span className="font-bold text-emerald-400">&lt; 3 Seconds</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Performers & Artists */}
            <section>
              <h2 className="text-xl font-black uppercase tracking-tight text-white mb-4">
                Performers & Lineup
              </h2>
              <div className="space-y-4">
                {event.artists.map((artist) => (
                  <div key={artist.id} className="flex gap-4 rounded-2xl border border-line bg-surface p-5 items-center">
                    <img
                      src={artist.imageUrl}
                      alt={artist.name}
                      className="size-16 rounded-xl object-cover shrink-0"
                    />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-polo-red">
                        {artist.role}
                      </span>
                      <h3 className="text-base font-extrabold text-white">{artist.name}</h3>
                      <p className="text-xs text-muted mt-1 leading-relaxed">{artist.bio}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Stage Schedule */}
            {event.schedule.length > 0 && (
              <section>
                <h2 className="text-xl font-black uppercase tracking-tight text-white mb-4">
                  Broadcast Schedule
                </h2>
                <div className="rounded-2xl border border-line bg-surface p-6 divide-y divide-line">
                  {event.schedule.map((item) => (
                    <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white text-sm">{item.title}</span>
                        <span className="block text-muted text-[11px] mt-0.5">{item.artistName} · {item.stageName}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-polo-red">{item.startTime} - {item.endTime}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right Column: Ticket Passes Selection */}
          <div className="lg:col-span-5" id="tickets">
            <div className="sticky top-24 space-y-6">
              <div className="rounded-3xl border border-line bg-surface p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-line pb-4 mb-6">
                  <div>
                    <h2 className="text-lg font-black uppercase tracking-tight text-white">
                      Digital Pass Tiers
                    </h2>
                    <span className="text-xs text-muted">Select an access tier to proceed to checkout</span>
                  </div>
                  <Ticket className="size-5 text-polo-red" />
                </div>

                <div className="space-y-4">
                  {ticketTypes.map((tier) => (
                    <div
                      key={tier.id}
                      className={`relative rounded-2xl border p-5 transition-all ${
                        tier.isSoldOut
                          ? 'border-line/40 bg-surface/40 opacity-60'
                          : tier.name === 'VIP'
                          ? 'border-amber-500/50 bg-amber-950/10 hover:border-amber-500'
                          : 'border-line bg-surface-raised hover:border-polo-red/60'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white text-sm">
                              {tier.displayName}
                            </span>
                            {tier.name === 'VIP' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                <Sparkles className="size-2.5" /> VIP
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted mt-1">{tier.description}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-base font-black text-white">
                            {formatCurrency(tier.priceInCents, tier.currency)}
                          </span>
                        </div>
                      </div>

                      {/* Perks */}
                      <ul className="mt-4 space-y-1.5 text-[11px] text-neutral-300 border-t border-line/60 pt-3">
                        {tier.perks.map((p, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <Check className="size-3 text-polo-red shrink-0" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Action */}
                      <div className="mt-5">
                        {tier.isSoldOut ? (
                          <button
                            disabled
                            className="w-full py-2.5 rounded-xl bg-line/50 text-muted font-bold text-xs uppercase cursor-not-allowed"
                          >
                            Sold Out
                          </button>
                        ) : (
                          <Link
                            href={`/checkout/${tier.id}`}
                            className="block w-full text-center py-2.5 rounded-xl bg-polo-red hover:bg-polo-red-dark text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-polo-red/20 active:scale-95"
                          >
                            Select This Pass
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t border-line/60 flex items-center gap-2 text-xs text-muted">
                  <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
                  <span>Instant digital delivery with authenticated single-stream playback token.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar on Mobile (Polostreaming UI style) */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-background/95 backdrop-blur-xl p-4 lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold text-muted block truncate max-w-[150px]">{event.title}</span>
            <span className="text-base font-black text-white">ETB 250.00</span>
          </div>
          <a
            href="#tickets"
            className="flex items-center gap-1.5 rounded-full bg-polo-red px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg active:scale-95"
          >
            <Ticket className="size-3.5" />
            <span>Get Pass</span>
          </a>
        </div>
      </div>
    </div>
  );
}
