import { EventService } from '@concert/business-logic';
import EventCard from '@/components/EventCard';
import Link from 'next/link';

export default async function EventsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const events = EventService.getEvents(status ? { status: status as any } : undefined);

  return (
    <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-line pb-8 mb-10 gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-polo-red">Schedule & Passes</span>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white mt-1">
            Live Concerts & Events
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-2 max-w-lg">
            Discover upcoming stadium tours, intimate acoustic evenings, and major festival live broadcasts.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-surface border border-line overflow-x-auto">
          <Link
            href="/events"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              !status ? 'bg-polo-red text-white' : 'text-muted hover:text-white'
            }`}
          >
            All Concerts
          </Link>
          <Link
            href="/events?status=LIVE"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              status === 'LIVE' ? 'bg-polo-red text-white' : 'text-muted hover:text-white'
            }`}
          >
            <span className="size-1.5 rounded-full bg-polo-red animate-ping" />
            Live Now
          </Link>
          <Link
            href="/events?status=SCHEDULED"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              status === 'SCHEDULED' ? 'bg-polo-red text-white' : 'text-muted hover:text-white'
            }`}
          >
            Upcoming
          </Link>
          <Link
            href="/replays"
            className="px-4 py-2 rounded-xl text-xs font-bold text-muted hover:text-white transition-all"
          >
            Replay VOD
          </Link>
        </div>
      </div>

      {/* Grid of Events */}
      {events.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-3xl border border-line">
          <h3 className="text-lg font-bold text-white">No concerts found in this category</h3>
          <p className="text-xs text-muted mt-1">Check back soon for newly scheduled tours and live streams.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
