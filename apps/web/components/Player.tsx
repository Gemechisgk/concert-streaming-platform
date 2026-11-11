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
  Wifi
} from 'lucide-react';

interface PlayerProps {
  streamUrl: string;
  posterUrl?: string;
  eventName: string;
  isLive?: boolean;
  streamToken?: string;
  onHeartbeat?: () => void;
}

export default function Player({
  streamUrl,
  posterUrl,
  eventName,
  isLive = true,
  streamToken,
  onHeartbeat
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [qualities, setQualities] = useState<string[]>([]);
  const [currentQualityIndex, setCurrentQualityIndex] = useState<number>(-1); // -1 = Auto
  const [showSettings, setShowSettings] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Initialize HLS player
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setHasError(false);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 15,
        liveSyncDurationCount: 3
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        setIsLoading(false);
        const levelNames = data.levels.map(l => `${l.height}p`);
        setQualities(levelNames);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn('HLS stream event:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error encountered, attempting recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media decode error, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              setHasError(true);
              setErrorMessage('The live stream feed is currently reconnecting or offline.');
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari HLS
      video.src = streamUrl;
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
  }, [streamUrl]);

  // Periodic heartbeat reporting
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (onHeartbeat) onHeartbeat();
      if (streamToken) {
        fetch('/api/v1/streams/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ streamToken, bitrateKbps: 4500 })
        }).catch(() => {});
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [isPlaying, streamToken, onHeartbeat]);

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
    }, 3000);
  };

  const retryPlayback = () => {
    setHasError(false);
    setIsLoading(true);
    if (hlsRef.current) {
      hlsRef.current.loadSource(streamUrl);
      hlsRef.current.startLoad();
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl select-none group border border-line"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        poster={posterUrl}
        playsInline
        onClick={togglePlay}
        className="size-full object-contain cursor-pointer"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-20">
          <RefreshCw className="size-10 text-polo-red animate-spin mb-3" />
          <span className="text-xs font-bold text-white tracking-wider uppercase">Connecting to Stage Origin...</span>
        </div>
      )}

      {/* Stream Failure / Offline Overlay */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 p-6 text-center">
          <AlertCircle className="size-12 text-polo-red mb-3" />
          <h3 className="text-base font-bold text-white mb-1">Broadcast Signal Reconnecting</h3>
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

      {/* Header Overlay (Stream Title & Live badge) */}
      <div
        className={`absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent transition-opacity duration-300 z-10 flex items-center justify-between ${
          controlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-3">
          {isLive && (
            <span className="flex items-center gap-1.5 rounded-full bg-polo-red px-2.5 py-0.5 text-[11px] font-black uppercase text-white tracking-wider animate-live-badge">
              <span className="size-1.5 rounded-full bg-white animate-ping" />
              LIVE
            </span>
          )}
          <span className="text-xs font-bold text-white tracking-wide truncate max-w-xs sm:max-w-md">
            {eventName}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-surface/80 backdrop-blur-md px-3 py-1 rounded-full border border-line">
          <Wifi className="size-3" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Low-Latency Mode</span>
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div
        className={`absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 z-10 flex items-center justify-between ${
          controlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Left: Play/Pause, Volume */}
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="p-2 rounded-full text-white hover:bg-white/20 transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="size-5" /> : <Play className="size-5 fill-white" />}
          </button>

          <div className="flex items-center gap-2 group/vol">
            <button
              onClick={toggleMute}
              className="p-2 rounded-full text-white hover:bg-white/20 transition-colors"
            >
              {isMuted || volume === 0 ? <VolumeX className="size-5 text-polo-red" /> : <Volume2 className="size-5" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 sm:w-24 accent-polo-red h-1 bg-white/30 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Right: Quality, Settings, Fullscreen */}
        <div className="flex items-center gap-2 relative">
          {/* Quality Selector */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-white hover:bg-white/20 transition-colors"
              title="Stream Quality"
            >
              <Settings className="size-4" />
              <span className="text-[11px]">
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
            className="p-2 rounded-full text-white hover:bg-white/20 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
