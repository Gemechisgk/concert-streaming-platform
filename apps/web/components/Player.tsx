'use client';

import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  RefreshCw,
  AlertCircle,
  Radio,
  Wifi,
  ExternalLink
} from 'lucide-react';

interface PlayerProps {
  streamUrl: string;
  posterUrl?: string;
  eventName: string;
  isLive?: boolean;
  streamToken?: string;
  onHeartbeat?: () => void;
}

function extractYouTubeId(url: string): string {
  if (!url) return 'mSrVwIRKASI';
  const match = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : 'mSrVwIRKASI';
}

export default function Player({
  streamUrl,
  posterUrl,
  eventName,
  isLive = true,
  streamToken,
  onHeartbeat
}: PlayerProps) {
  const youtubeId = extractYouTubeId(streamUrl) || 'mSrVwIRKASI';
  const [sourceMode, setSourceMode] = useState<'youtube' | 'hls'>('youtube');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qualities, setQualities] = useState<string[]>(['1080p', '720p', '480p']);
  const [currentQualityIndex, setCurrentQualityIndex] = useState<number>(-1); // -1 = Auto
  const [showSettings, setShowSettings] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Initialize HLS player when sourceMode is HLS
  useEffect(() => {
    if (sourceMode !== 'hls') {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setHasError(false);

    const targetHlsUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 15,
        liveSyncDurationCount: 3
      });

      hlsRef.current = hls;
      hls.loadSource(targetHlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setIsLoading(false);
        const levelNames = data.levels.map(l => `${l.height}p`);
        if (levelNames.length > 0) setQualities(levelNames);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn('HLS stream event:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setHasError(true);
              setErrorMessage('The backup live stream feed is currently reconnecting.');
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = targetHlsUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [sourceMode]);

  // Adaptive jittered heartbeat reporting to smoothly distribute 50,000 concurrent viewer pulses
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const getRandomJitteredInterval = () => 28000 + Math.random() * 6000; // 28s - 34s randomized

    const pulseHeartbeat = () => {
      if (onHeartbeat) onHeartbeat();
      if (streamToken) {
        fetch('/api/v1/streams/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ streamToken, bitrateKbps: 4500 })
        }).catch(() => {});
      }
      timer = setTimeout(pulseHeartbeat, getRandomJitteredInterval());
    };

    timer = setTimeout(pulseHeartbeat, getRandomJitteredInterval());
    return () => clearTimeout(timer);
  }, [streamToken, onHeartbeat]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(console.error);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  const selectQuality = (index: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
      setCurrentQualityIndex(index);
    }
    setShowSettings(false);
  };

  const handleMouseMove = () => {
    setControlsVisible(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) setControlsVisible(false);
    }, 3500);
  };

  const retryPlayback = () => {
    setHasError(false);
    setIsLoading(true);
    if (hlsRef.current) {
      hlsRef.current.loadSource('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8');
      hlsRef.current.startLoad();
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Video Container (16:9 Aspect Ratio) */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onTouchStart={() => setControlsVisible(true)}
        className="relative aspect-video w-full overflow-hidden rounded-none sm:rounded-2xl bg-black shadow-2xl select-none group border-b sm:border border-line"
      >
        {/* 1. YouTube Live Feed Embed (Default) */}
        {sourceMode === 'youtube' ? (
          <div className="relative size-full overflow-hidden bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&mute=0&controls=1&enablejsapi=1&playsinline=1&rel=0&modestbranding=1`}
              title={eventName}
              className="size-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        ) : (
          /* 2. Low-Latency HLS Video Player */
          <div className="relative size-full">
            <video
              ref={videoRef}
              poster={posterUrl}
              playsInline
              onClick={togglePlay}
              className="size-full object-contain cursor-pointer"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-20">
                <RefreshCw className="size-8 sm:size-10 text-polo-red animate-spin mb-3" />
                <span className="text-xs font-bold text-white tracking-wider uppercase">
                  Connecting to Feshta Fest Stage Origin...
                </span>
              </div>
            )}

            {hasError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 p-6 text-center">
                <AlertCircle className="size-10 sm:size-12 text-polo-red mb-3" />
                <h3 className="text-sm sm:text-base font-bold text-white mb-1">Broadcast Signal Reconnecting</h3>
                <p className="text-xs text-muted max-w-md mb-4">{errorMessage}</p>
                <button
                  onClick={retryPlayback}
                  className="inline-flex items-center gap-2 rounded-full bg-polo-red px-5 py-2 text-xs font-bold text-white hover:bg-polo-red-dark transition-all"
                >
                  <RefreshCw className="size-3.5" />
                  <span>Retry Connection</span>
                </button>
              </div>
            )}

            {/* HLS Native Bottom Controls */}
            <div
              className={`absolute bottom-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent transition-opacity duration-300 z-10 flex items-center justify-between ${
                controlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={togglePlay}
                  className="p-1.5 sm:p-2 rounded-full text-white hover:bg-white/20 transition-colors"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="size-4 sm:size-5" /> : <Play className="size-4 sm:size-5 fill-white" />}
                </button>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={toggleMute}
                    className="p-1.5 sm:p-2 rounded-full text-white hover:bg-white/20 transition-colors"
                  >
                    {isMuted || volume === 0 ? <VolumeX className="size-4 sm:size-5 text-polo-red" /> : <Volume2 className="size-4 sm:size-5" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-12 sm:w-20 accent-polo-red h-1 bg-white/30 rounded-lg cursor-pointer hidden xs:block"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 relative">
                <div className="relative">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold text-white hover:bg-white/20 transition-colors"
                    title="Stream Quality"
                  >
                    <Settings className="size-3.5 sm:size-4" />
                    <span className="text-[10px] sm:text-[11px]">
                      {currentQualityIndex === -1 ? 'Auto' : qualities[currentQualityIndex] || 'Auto'}
                    </span>
                  </button>

                  {showSettings && (
                    <div className="absolute bottom-10 right-0 w-36 rounded-xl border border-line bg-surface/95 backdrop-blur-xl p-2 shadow-2xl z-30">
                      <span className="block px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                        Quality Profile
                      </span>
                      <button
                        onClick={() => selectQuality(-1)}
                        className={`w-full text-left px-2 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                          currentQualityIndex === -1 ? 'bg-polo-red text-white' : 'text-foreground hover:bg-surface-raised'
                        }`}
                      >
                        Auto (Adaptive)
                      </button>
                      {qualities.map((q, idx) => (
                        <button
                          key={q}
                          onClick={() => selectQuality(idx)}
                          className={`w-full text-left px-2 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                            currentQualityIndex === idx ? 'bg-polo-red text-white' : 'text-foreground hover:bg-surface-raised'
                          }`}
                        >
                          {q} HD
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 sm:p-2 rounded-full text-white hover:bg-white/20 transition-colors"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize className="size-4 sm:size-5" /> : <Maximize className="size-4 sm:size-5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Badge Overlay on Video Top-Left */}
        <div className="absolute top-2.5 left-2.5 sm:top-3.5 sm:left-3.5 z-20 pointer-events-none flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5 rounded-full bg-polo-red/90 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-black uppercase text-white tracking-wider animate-live-badge shadow-lg shadow-polo-red/30">
              <span className="size-1.5 rounded-full bg-white animate-ping" />
              LIVE
            </span>
          )}
          <span className="text-[11px] font-bold text-white/90 drop-shadow hidden xs:inline truncate max-w-[200px]">
            {eventName}
          </span>
        </div>
      </div>

      {/* Stream Source Selector Bar directly below video (Touch-Optimized) */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface border-b border-line text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[10px] uppercase font-black text-muted tracking-wider mr-1 shrink-0">
            Feed:
          </span>
          <button
            type="button"
            onClick={() => setSourceMode('youtube')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shrink-0 transition-all ${
              sourceMode === 'youtube'
                ? 'bg-polo-red text-white shadow-md shadow-polo-red/25'
                : 'bg-surface-raised border border-line text-neutral-300 hover:text-white'
            }`}
          >
            <Radio className="size-3 animate-pulse text-white" />
            <span>Veronica Live</span>
          </button>
          <button
            type="button"
            onClick={() => setSourceMode('hls')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shrink-0 transition-all ${
              sourceMode === 'hls'
                ? 'bg-polo-red text-white shadow-md shadow-polo-red/25'
                : 'bg-surface-raised border border-line text-neutral-300 hover:text-white'
            }`}
          >
            <Wifi className="size-3" />
            <span>Low-Latency HLS</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            1080p60
          </span>
        </div>
      </div>
    </div>
  );
}
