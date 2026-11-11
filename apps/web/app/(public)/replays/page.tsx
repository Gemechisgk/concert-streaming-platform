import Link from 'next/link';
import { EventService } from '@concert/business-logic';
import { Play, Clock, Calendar, Film, Sparkles } from 'lucide-react';
import { formatConcertDate } from '@concert/shared';

export default function ReplaysPage() {
  const pastEvents = EventService.getEvents().filter(e => e.status === 'ENDED' || e.status === 'LIVE');

  return (
    <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12">
      <div className="border-b border-line pb-8 mb-10">
        <span className="text-xs font-bold uppercase tracking-widest text-polo-red">On-Demand VOD</span>
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white mt-1">
          Concert Replay Library
        </h1>
        <p className="text-xs sm:text-sm text-muted mt-2 max-w-lg">
          Relive past historic live performances in full 4K and lossless stereo audio with active ticket pass entitlements.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pastEvents.map((event) => (
          <div
            key={event.id}
            className="group rounded-2xl border border-line bg-surface overflow-hidden hover:border-polo-red/50 transition-all flex flex-col shadow-xl"
          >
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              <img
                src={event.bannerImage}
                alt={event.title}
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  href={`/watch/${event.id}`}
                  className="flex size-14 items-center justify-center rounded-full bg-polo-red text-white shadow-2xl hover:scale-110 transition-transform"
                >
                  <Play className="size-6 fill-white ml-1" />
                </Link>
              </div>

              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="flex items-center gap-1 rounded-full bg-surface/90 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-white border border-white/10">
                  <Film className="size-3 text-polo-red" />
                  Full VOD Replay
                </span>
              </div>

              <div className="absolute bottom-3 right-3">
                <span className="rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-mono text-neutral-300">
                  2h 15m
                </span>
              </div>
            </div>

            <div className="p-5 flex flex-1 flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-polo-red">
                  {event.artists[0]?.name || 'Featured Maestro'}
                </span>
                <h3 className="text-base font-extrabold text-white mt-1 line-clamp-1 group-hover:text-polo-red transition-colors">
                  {event.title}
                </h3>
                <p className="text-xs text-muted mt-1.5 line-clamp-2 leading-relaxed">
                  {event.description}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-line/60 flex items-center justify-between">
                <span className="text-xs text-muted flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-polo-red" />
                  {formatConcertDate(event.startTime)}
                </span>

                <Link
                  href={`/watch/${event.id}`}
                  className="text-xs font-bold text-white hover:text-polo-red transition-colors flex items-center gap-1"
                >
                  Stream VOD <Play className="size-3 fill-current inline" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
