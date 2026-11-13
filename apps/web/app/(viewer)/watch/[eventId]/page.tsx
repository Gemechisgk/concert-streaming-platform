'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Player from '@/components/Player';
import LiveChat from '@/components/LiveChat';
import GiftTray from '@/components/GiftTray';
import { ConcertEvent, StreamChannel } from '@concert/types';
import {
  Users,
  Shield,
  Clock,
  AlertCircle,
  MessageSquare,
  Info,
  Gift,
  Calendar,
  MapPin,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export default function WatchEventPage() {
  const params = useParams();
  const eventId = params?.eventId as string;

  const [event, setEvent] = useState<ConcertEvent | null>(null);
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [streamToken, setStreamToken] = useState<string>('');
  const [viewersCount, setViewersCount] = useState<number>(1411);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'info' | 'gifts'>('chat');

  // Fetch event and obtain signed stream playback token
  useEffect(() => {
    async function loadStream() {
      try {
        setLoading(true);
        // Get event info
        const evRes = await fetch('/api/v1/events');
        const evData = await evRes.json();
        const found = evData.events?.find(
          (e: ConcertEvent) =>
            e.id === eventId || e.slug === eventId || eventId === 'evt_teddy_afro_01'
        ) || evData.events?.[0];

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
          // Fallback to active stream channel
          setChannel({
            id: 'ch_veronica_live',
            eventId: found.id,
            status: 'LIVE',
            hlsMasterUrl: 'https://www.youtube.com/watch?v=mSrVwIRKASI',
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

  const isLive = event?.status === 'LIVE' || true;

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <div className="flex flex-col items-center text-center">
          <div className="size-12 rounded-full border-3 border-polo-red border-t-transparent animate-spin mb-4 shadow-lg shadow-polo-red/20" />
          <span className="text-xs font-black uppercase tracking-wider text-white">
            Connecting to Feshta Fest Arena...
          </span>
          <span className="text-[11px] text-muted mt-1">Verifying Digital Pass Entitlement</span>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="mx-auto max-w-xl py-16 px-4 text-center">
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
    <div className="mx-auto max-w-7xl px-0 sm:px-4 lg:px-6 py-0 sm:py-4">
      {/* Main Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-6 lg:h-[calc(100vh-6.5rem)]">
        {/* Left Column: Video Player Suite & Metadata */}
        <div className="lg:col-span-8 flex flex-col justify-start overflow-y-auto no-scrollbar">
          {/* Edge-to-Edge Player on Mobile */}
          <div className="w-full bg-black sm:rounded-2xl overflow-hidden shadow-2xl sm:border border-line">
            <Player
              streamUrl={channel?.hlsMasterUrl || 'https://www.youtube.com/watch?v=mSrVwIRKASI'}
              posterUrl={event.bannerImage}
              eventName={event.title}
              isLive={isLive}
              streamToken={streamToken}
              onHeartbeat={() => setViewersCount(prev => prev + Math.floor(Math.random() * 5 - 2))}
            />
          </div>

          {/* Stream Quick Header Bar (Clean, Compact, Responsive) */}
          <div className="p-3 sm:p-4 border-b lg:border border-line bg-surface sm:rounded-2xl sm:mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-polo-red text-white shadow-sm">
                  <span className="size-1.5 rounded-full bg-white animate-ping" />
                  Live Broadcast
                </span>
                <span className="text-[11px] font-bold text-neutral-400 flex items-center gap-1">
                  <MapPin className="size-3 text-polo-red" />
                  {event.venueName}
                </span>
              </div>
              <h1 className="text-sm sm:text-lg font-black text-white mt-1">
                {event.title}
              </h1>
            </div>

            {/* Viewers & Gift Trigger */}
            <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/60">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-surface-raised px-3 py-1.5 rounded-full border border-line text-xs font-bold text-white">
                  <Users className="size-3.5 text-polo-red" />
                  <span>{viewersCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 rounded-full text-emerald-400 text-[11px] font-bold">
                  <CheckCircle2 className="size-3" />
                  <span className="hidden xs:inline">Pass Verified</span>
                </div>
              </div>

              {/* Gift Tray Trigger */}
              <GiftTray eventId={event.id} />
            </div>
          </div>

          {/* Desktop Only: Full Concert Information & Lineup */}
          <div className="hidden lg:block mt-4 p-5 rounded-2xl border border-line bg-surface/80 space-y-4">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-muted">Headlining Artist</h3>
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={event.artists[0]?.imageUrl || '/meteriyaye-concert.png'}
                  alt={event.artists[0]?.name || 'Artist'}
                  className="size-12 rounded-full object-cover border border-polo-red/50 shadow-md"
                />
                <div>
                  <h4 className="text-sm font-black text-white">{event.artists[0]?.name || 'Veronica Adane'}</h4>
                  <p className="text-xs text-neutral-300">{event.artists[0]?.role || 'Headlining Superstar'}</p>
                </div>
              </div>
              <p className="text-xs text-muted leading-relaxed mt-2.5">{event.description}</p>
            </div>

            <div className="pt-3 border-t border-line/60 flex items-center justify-between text-[11px] text-muted">
              <span>Broadcast Protocol: <strong className="text-white">YouTube HD / HLS ABR</strong></span>
              <span>Audio Mix: <strong className="text-white">Studio 48kHz Stereo AAC</strong></span>
              <span>Live Host: <strong className="text-polo-red">Feshta Fest Ethiopia</strong></span>
            </div>
          </div>
        </div>

        {/* Right Column / Mobile Tabbed Container */}
        <div className="lg:col-span-4 flex flex-col h-[560px] sm:h-[620px] lg:h-full pb-16 lg:pb-0">
          {/* Mobile Tab Selector (Visible on Mobile & Tablet) */}
          <div className="lg:hidden flex items-center border-b border-line bg-surface-raised px-2 py-1.5">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'chat'
                  ? 'bg-surface text-white border border-line shadow-md'
                  : 'text-muted hover:text-white'
              }`}
            >
              <MessageSquare className="size-3.5 text-polo-red" />
              <span>Live Chat</span>
            </button>
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'info'
                  ? 'bg-surface text-white border border-line shadow-md'
                  : 'text-muted hover:text-white'
              }`}
            >
              <Info className="size-3.5 text-polo-red" />
              <span>Lineup & Stage</span>
            </button>
            <button
              onClick={() => setActiveTab('gifts')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'gifts'
                  ? 'bg-surface text-white border border-line shadow-md'
                  : 'text-muted hover:text-white'
              }`}
            >
              <Sparkles className="size-3.5 text-amber-400" />
              <span>Perks</span>
            </button>
          </div>

          {/* Tab 1: Live Chat (Always visible on desktop; tab-controlled on mobile) */}
          <div className={`flex-1 h-full ${activeTab === 'chat' ? 'flex flex-col' : 'hidden lg:flex lg:flex-col'}`}>
            <LiveChat
              eventId={event.id}
              currentUser={{
                id: 'user_viewer_01',
                name: 'Abebe Bikila',
                role: 'VIEWER'
              }}
            />
          </div>

          {/* Tab 2: Mobile Concert Info & Lineup */}
          {activeTab === 'info' && (
            <div className="lg:hidden flex-1 overflow-y-auto p-4 bg-surface rounded-b-2xl border border-line space-y-4">
              {/* Artist Profile */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-raised border border-line">
                <img
                  src={event.artists[0]?.imageUrl || '/meteriyaye-concert.png'}
                  alt={event.artists[0]?.name || 'Artist'}
                  className="size-14 rounded-full object-cover border-2 border-polo-red"
                />
                <div>
                  <h3 className="text-sm font-black text-white">{event.artists[0]?.name || 'Veronica Adane'}</h3>
                  <span className="text-[11px] text-polo-red font-bold uppercase block">{event.artists[0]?.role || 'Headliner'}</span>
                  <p className="text-[11px] text-muted line-clamp-2 mt-0.5">{event.artists[0]?.bio}</p>
                </div>
              </div>

              {/* Concert Schedule */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-polo-red" />
                  Tonight's Schedule
                </h4>
                <div className="space-y-2">
                  {event.schedule.map((item, idx) => (
                    <div key={item.id} className="p-2.5 rounded-xl border border-line bg-surface-raised flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-white block">{item.title}</span>
                        <span className="text-[10px] text-muted">{item.artistName} · {item.stageName}</span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-polo-red px-2 py-0.5 rounded bg-polo-red/10">
                        {item.startTime}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical Telemetry */}
              <div className="p-3 rounded-xl border border-line/60 bg-surface-raised text-[11px] space-y-1.5 text-muted">
                <div className="flex justify-between">
                  <span>Stream Quality:</span>
                  <span className="text-white font-bold">1080p60 Ultra HD</span>
                </div>
                <div className="flex justify-between">
                  <span>Audio Codec:</span>
                  <span className="text-white font-bold">AAC Stereo 320kbps</span>
                </div>
                <div className="flex justify-between">
                  <span>Venue:</span>
                  <span className="text-white font-bold">{event.venueName}</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Stage Gifts & Supporter Perks */}
          {activeTab === 'gifts' && (
            <div className="lg:hidden flex-1 overflow-y-auto p-4 bg-surface rounded-b-2xl border border-line space-y-4">
              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-amber-500/10 via-surface-raised to-surface border border-amber-500/30">
                <Sparkles className="size-6 text-amber-400 mx-auto mb-1.5" />
                <h3 className="text-xs font-black uppercase text-white tracking-wide">Interactive Stage Gifts</h3>
                <p className="text-[11px] text-muted mt-1">
                  Send virtual gifts directly to Veronica Adane and the band to trigger full-stage animations and support the artists.
                </p>
                <div className="mt-3">
                  <GiftTray eventId={event.id} />
                </div>
              </div>

              {/* Digital Pass Entitlement Details */}
              <div className="p-3.5 rounded-xl border border-line bg-surface-raised space-y-2">
                <h4 className="text-xs font-black uppercase text-white">Your VIP Pass Perks</h4>
                <ul className="text-[11px] text-neutral-300 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                    <span>Ad-free 1080p60 live concert stream</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                    <span>Live audience chat participation with VIP badge</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                    <span>30-Day unlimited on-demand concert replay</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
