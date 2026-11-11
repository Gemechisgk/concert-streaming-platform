import Link from 'next/link';
import { ConcertEvent } from '@concert/types';
import { Calendar, MapPin, Ticket, Play } from 'lucide-react';
import { formatConcertDate } from '@concert/shared';

export default function EventCard({ event }: { event: ConcertEvent }) {
  const isLive = event.status === 'LIVE';

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface hover:border-polo-red/40 transition-all duration-300 hover:shadow-2xl hover:shadow-polo-red/10">
      {/* Thumbnail */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-raised">
        <img
          src={event.thumbnailImage}
          alt={event.title}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-80" />

        {/* Live Badge or Date */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          {isLive ? (
            <span className="flex items-center gap-1.5 rounded-full bg-polo-red px-3 py-1 text-xs font-black uppercase tracking-wider text-white shadow-lg animate-live-badge">
              <span className="size-2 rounded-full bg-white animate-ping" />
              LIVE NOW
            </span>
          ) : (
            <span className="rounded-full bg-surface/85 backdrop-blur-md px-3 py-1 text-xs font-bold text-white border border-white/10">
              {event.status}
            </span>
          )}
        </div>

        {isLive && (
          <div className="absolute bottom-3 right-3">
            <Link
              href={`/watch/${event.id}`}
              className="flex items-center gap-1.5 rounded-full bg-white text-background px-3 py-1.5 text-xs font-bold hover:bg-polo-red hover:text-white transition-colors shadow-lg"
            >
              <Play className="size-3 fill-current" />
              Watch Stream
            </Link>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-xs text-muted mb-2">
          <Calendar className="size-3.5 text-polo-red" />
          <span>{formatConcertDate(event.startTime)}</span>
          <span>•</span>
          <MapPin className="size-3.5 text-muted" />
          <span>{event.venueCity}, {event.venueCountry}</span>
        </div>

        <h3 className="text-base font-extrabold text-white group-hover:text-polo-red transition-colors line-clamp-1">
          {event.title}
        </h3>

        <p className="mt-1.5 text-xs text-muted line-clamp-2 leading-relaxed flex-1">
          {event.tagline}
        </p>

        {/* Artists tags */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {event.artists.map(a => (
            <span
              key={a.id}
              className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-surface-raised border border-line text-neutral-300"
            >
              {a.name}
            </span>
          ))}
        </div>

        {/* Footer actions */}
        <div className="mt-5 pt-4 border-t border-line/60 flex items-center justify-between">
          <div>
            <span className="block text-[10px] uppercase font-bold text-muted">Passes from</span>
            <span className="text-sm font-black text-white">ETB 250.00</span>
          </div>

          <Link
            href={`/events/${event.slug}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-surface-raised border border-line hover:border-polo-red px-4 py-2 text-xs font-bold text-white hover:bg-polo-red transition-all"
          >
            <Ticket className="size-3.5" />
            <span>Select Passes</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
