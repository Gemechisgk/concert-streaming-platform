'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Player from '@/components/Player';
import LiveChat from '@/components/LiveChat';
import GiftTray from '@/components/GiftTray';
import { ConcertEvent, StreamChannel, Ticket } from '@concert/types';
import { Radio, Users, Shield, Clock, AlertCircle, Share2, Ticket as TicketIcon } from 'lucide-react';

export default function WatchEventPage() {
  const params = useParams();
  const eventId = params?.eventId as string;

  const [event, setEvent] = useState<ConcertEvent | null>(null);
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [streamToken, setStreamToken] = useState<string>('');
  const [viewersCount, setViewersCount] = useState<number>(1420);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch event and obtain signed stream playback token
  useEffect(() => {
    async function loadStream() {
      try {
        setLoading(true);
        // Get event info
        const evRes = await fetch('/api/v1/events');
        const evData = await evRes.json();
        const found = evData.events?.find((e: ConcertEvent) => e.id === eventId || e.slug === eventId);
        if (!found) {
          setError('Concert event not found.');
          setLoading(false);
          return;
        }
        setEvent(found);

        // Fetch or request token
        const tokenRes = await fetch('/api/v1/streams/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketCode: 'TKT-TED-VIP-0001-9X8K2', // authenticated pass
            eventId: found.id
          })
        });

        const tokenData = await tokenRes.json();
        if (tokenRes.ok) {
          setStreamToken(tokenData.token);
          setChannel(tokenData.channel);
        } else {
          // If offline or ticket pass required, fallback to demo channel
          setChannel({
            id: 'ch_fallback',
            eventId: found.id,
            status: found.status === 'LIVE' ? 'LIVE' : 'OFFLINE',
            hlsMasterUrl: 'https://www.youtube.com/watch?v=3cIpSCEs-n8',
            qualities: [],
            primaryIngestRtmp: '',
            backupIngestRtmp: '',
            streamKey: '',
            fps: 60,
            currentBitrateKbps: 4800,
            dropFrames: 0
          });
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (eventId) {
      loadStream();
    }
  }, [eventId]);

  const isLive = event?.status === 'LIVE';

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="size-10 rounded-full border-2 border-polo-red border-t-transparent animate-spin mb-4" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Authorizing Stream Pass...</span>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="mx-auto max-w-xl py-20 px-4 text-center">
        <AlertCircle className="size-12 text-polo-red mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">Stream Access Issue</h2>
        <p className="text-xs text-muted mb-6">{error || 'Event could not be loaded.'}</p>
        <a href="/events" className="rounded-full bg-polo-red px-6 py-2.5 text-xs font-bold text-white">
          Browse Live Concerts
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-line gap-4">
        <div className="flex items-center gap-3">
          {isLive ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase bg-polo-red text-white animate-live-badge">
              <span className="size-2 rounded-full bg-white animate-ping" />
              LIVE BROADCAST
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase bg-surface-raised border border-line text-neutral-300">
              <Clock className="size-3.5 text-polo-red" />
              PRE-SHOW WAITING ROOM
            </span>
          )}

          <h1 className="text-base sm:text-lg font-black text-white truncate max-w-md">
            {event.title}
          </h1>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 bg-surface px-3 py-1.5 rounded-full border border-line text-neutral-300">
            <Users className="size-3.5 text-polo-red" />
            <span className="font-mono font-bold text-white">{viewersCount.toLocaleString()}</span>
            <span className="text-[10px] text-muted uppercase">Viewers</span>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full text-emerald-400">
            <Shield className="size-3.5" />
            <span className="text-[10px] font-bold uppercase">Pass Authenticated</span>
          </div>

          {/* Virtual Gift Launcher */}
          <GiftTray eventId={event.id} />
        </div>
      </div>

      {/* Main Grid: Player (8 cols) + Chat (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-auto lg:h-[72vh]">
        {/* Left: Video Player Suite */}
        <div className="lg:col-span-8 flex flex-col justify-between">
          <div className="flex-1 w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-line">
            <Player
              streamUrl={channel?.hlsMasterUrl || 'https://www.youtube.com/watch?v=3cIpSCEs-n8'}
              posterUrl={event.bannerImage}
              eventName={event.title}
              isLive={isLive}
              streamToken={streamToken}
              onHeartbeat={() => setViewersCount(prev => prev + Math.floor(Math.random() * 5 - 2))}
            />
          </div>

          {/* Stream Information Footnote */}
          <div className="mt-4 p-4 rounded-2xl border border-line bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-polo-red block">
                {event.venueName} · {event.venueCity}
              </span>
              <p className="text-xs text-neutral-300 mt-0.5 line-clamp-1">{event.tagline}</p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold bg-surface-raised px-2.5 py-1 rounded-lg border border-line text-neutral-300">
                1080p60 SRS Origin
              </span>
              <span className="text-[10px] uppercase font-bold bg-surface-raised px-2.5 py-1 rounded-lg border border-line text-neutral-300">
                Studio AAC
              </span>
            </div>
          </div>
        </div>

        {/* Right: Live Chat Suite */}
        <div className="lg:col-span-4 h-[550px] lg:h-full">
          <LiveChat
            eventId={event.id}
            currentUser={{
              id: 'user_viewer_01',
              name: 'Abebe Bikila',
              role: 'VIEWER'
            }}
          />
        </div>
      </div>
    </div>
  );
}
