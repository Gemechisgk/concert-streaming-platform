'use client';

import { useState, useEffect } from 'react';
import { ConcertEvent, EventStatus } from '@concert/types';
import { formatConcertDate } from '@concert/shared';
import { Plus, Edit2, Play, CheckCircle, Radio, Trash2, Calendar, MapPin, X } from 'lucide-react';

export default function AdminEventsPage() {
  const [events, setEvents] = useState<ConcertEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [venueName, setVenueName] = useState('Millennium Hall');
  const [venueCity, setVenueCity] = useState('Addis Ababa');

  const fetchEvents = () => {
    fetch('/api/v1/events')
      .then(res => res.json())
      .then(data => {
        if (data.events) setEvents(data.events);
      });
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug,
          tagline,
          description,
          bannerImage: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1920&auto=format&fit=crop',
          thumbnailImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop',
          venueName,
          venueCity,
          venueCountry: 'Ethiopia',
          startTime: new Date(Date.now() + 86400000 * 7).toISOString(),
          endTime: new Date(Date.now() + 86400000 * 7 + 14400000).toISOString(),
          featured: true
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchEvents();
        setTitle('');
        setSlug('');
        setTagline('');
        setDescription('');
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to create event');
      }
    } catch {
      alert('Error creating concert');
    }
  };

  const handleStatusChange = (eventId: string, newStatus: EventStatus) => {
    setEvents(prev => prev.map(e => (e.id === eventId ? { ...e, status: newStatus } : e)));
    alert(`Event status updated to ${newStatus}`);
  };

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">
            Concerts & Stage Events
          </h1>
          <p className="text-xs text-muted mt-1">
            Manage concert broadcasts, lineup schedules, ticketing configuration, and live state transitions.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-polo-red px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-polo-red-dark transition-all shadow-lg active:scale-95"
        >
          <Plus className="size-4" />
          <span>Add New Concert</span>
        </button>
      </div>

      {/* Events List */}
      <div className="grid grid-cols-1 gap-4">
        {events.map((event) => (
          <div
            key={event.id}
            className="rounded-3xl border border-line bg-surface p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl"
          >
            <div className="flex items-start sm:items-center gap-4">
              <img
                src={event.thumbnailImage}
                alt={event.title}
                className="size-16 sm:size-20 rounded-2xl object-cover shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase ${
                      event.status === 'LIVE'
                        ? 'bg-polo-red text-white animate-pulse'
                        : 'bg-surface-raised border border-line text-neutral-300'
                    }`}
                  >
                    {event.status}
                  </span>
                  <span className="text-xs text-muted">
                    <Calendar className="size-3 inline mr-1 text-polo-red" />
                    {formatConcertDate(event.startTime)}
                  </span>
                  <span className="text-xs text-muted">
                    <MapPin className="size-3 inline mr-1 text-muted" />
                    {event.venueCity}
                  </span>
                </div>

                <h3 className="text-base font-black text-white mt-1">{event.title}</h3>
                <p className="text-xs text-muted mt-0.5 line-clamp-1">{event.tagline}</p>
              </div>
            </div>

            {/* Status Transition Control */}
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={event.status}
                onChange={(e) => handleStatusChange(event.id, e.target.value as EventStatus)}
                className="rounded-xl border border-line bg-surface-raised px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-polo-red"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="SCHEDULED">SCHEDULED</option>
                <option value="LIVE">LIVE (ON AIR)</option>
                <option value="ENDED">ENDED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>

              <a
                href={`/events/${event.slug}`}
                target="_blank"
                className="p-2 rounded-xl border border-line bg-surface-raised text-muted hover:text-white transition-colors"
                title="Preview public page"
              >
                <Play className="size-4" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-3xl border border-line bg-surface p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-muted hover:text-white"
            >
              <X className="size-5" />
            </button>

            <h2 className="text-lg font-black uppercase tracking-tight text-white mb-4">
              Create New Concert Broadcast
            </h2>

            <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-muted mb-1">Concert Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Addis Reggae & Roots Fest"
                  value={title}
                  onChange={e => {
                    setTitle(e.target.value);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                  }}
                  className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-white focus:outline-none focus:border-polo-red"
                />
              </div>

              <div>
                <label className="block font-bold text-muted mb-1">URL Slug</label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-white font-mono focus:outline-none focus:border-polo-red"
                />
              </div>

              <div>
                <label className="block font-bold text-muted mb-1">Tagline</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. An electrifying night of live cultural rhythms"
                  value={tagline}
                  onChange={e => setTagline(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-white focus:outline-none focus:border-polo-red"
                />
              </div>

              <div>
                <label className="block font-bold text-muted mb-1">Description</label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Full description of the concert program..."
                  className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-white focus:outline-none focus:border-polo-red"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-muted mb-1">Venue Name</label>
                  <input
                    type="text"
                    value={venueName}
                    onChange={e => setVenueName(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2 text-white focus:outline-none focus:border-polo-red"
                  />
                </div>
                <div>
                  <label className="block font-bold text-muted mb-1">City</label>
                  <input
                    type="text"
                    value={venueCity}
                    onChange={e => setVenueCity(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2 text-white focus:outline-none focus:border-polo-red"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-line text-muted hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-polo-red text-white font-bold uppercase tracking-wider hover:bg-polo-red-dark"
                >
                  Publish Concert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
