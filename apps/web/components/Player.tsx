'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
  Video,
  Clapperboard,
  CheckCircle2,
  Layers,
  Sparkles
} from 'lucide-react';
import { PublicCameraFeed, CameraOperatingMode } from '@concert/types';
import { io, Socket } from 'socket.io-client';
import { getRealtimeSocketUrl } from '@/lib/socket';

interface PlayerProps {
  streamUrl: string;
  posterUrl?: string;
  eventName: string;
  eventId?: string;
  isLive?: boolean;
  streamToken?: string;
  ticketCode?: string;
  cameraMode?: CameraOperatingMode;
  availableCameras?: PublicCameraFeed[];
  initialActiveCameraId?: string;
  onCameraChange?: (cameraId: string) => void;
  onHeartbeat?: () => void;
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export default function Player({
  streamUrl,
  posterUrl,
  eventName,
  eventId,
  isLive = true,
  streamToken: initialStreamToken,
  ticketCode,
  cameraMode: initialCameraMode = 'VIEWER_SELECTABLE',
  availableCameras: initialAvailableCameras = [],
  initialActiveCameraId,
  onCameraChange,
  onHeartbeat
}: PlayerProps) {
  const detectedYouTubeId = extractYouTubeId(streamUrl);
  const youtubeId = detectedYouTubeId || '';
  const [sourceMode, setSourceMode] = useState<'youtube' | 'hls'>(detectedYouTubeId ? 'youtube' : 'hls');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Stream & Token State
  const [currentStreamUrl, setCurrentStreamUrl] = useState<string>(streamUrl);
  const [activeStreamToken, setActiveStreamToken] = useState<string | undefined>(initialStreamToken);
  const [cameraMode, setCameraMode] = useState<CameraOperatingMode>(initialCameraMode);
  const [cameras, setCameras] = useState<PublicCameraFeed[]>(initialAvailableCameras);
  const [selectedCameraId, setSelectedCameraId] = useState<string>(
    initialActiveCameraId || initialAvailableCameras[0]?.id || 'cam_1'
  );

  // Playback & UI State
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
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [switchingCameraName, setSwitchingCameraName] = useState<string>('');
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Keep state in sync with parent props if they change
  useEffect(() => {
    if (streamUrl && streamUrl !== currentStreamUrl) {
      setCurrentStreamUrl(streamUrl);
    }
  }, [streamUrl]);

  useEffect(() => {
    if (initialStreamToken) {
      setActiveStreamToken(initialStreamToken);
    }
  }, [initialStreamToken]);

  useEffect(() => {
    if (initialAvailableCameras && initialAvailableCameras.length > 0) {
      setCameras(initialAvailableCameras);
    }
  }, [initialAvailableCameras]);

  useEffect(() => {
    if (initialCameraMode) {
      setCameraMode(initialCameraMode);
    }
  }, [initialCameraMode]);

  // Fetch cameras if not supplied
  useEffect(() => {
    if (cameras.length === 0 && eventId) {
      fetch(`/api/v1/cameras?eventId=${eventId}`)
        .then(res => res.json())
        .then(data => {
          if (data.cameras && data.cameras.length > 0) {
            setCameras(data.cameras);
            setCameraMode(data.cameraMode || 'DIRECTOR_CONTROLLED');
            if (data.activeCameraId) {
              setSelectedCameraId(data.activeCameraId);
            }
          }
        })
        .catch(() => {});
    }
  }, [eventId, cameras.length]);

  // --------------------------------------------------------------------------
  // Real-Time Socket.IO Listener for Director Switches & Operating Mode
  // --------------------------------------------------------------------------
  useEffect(() => {
    const socketUrl = getRealtimeSocketUrl();
    if (!socketUrl) return;

    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3,
      reconnectionDelay: 5000,
      timeout: 4000
    });

    socket.on('connect_error', (error) => {
      // Log for debugging, but gracefully handle offline or unreachable sidecar in production
      console.warn('[Socket.IO] Connection error:', error?.message || error);
    });

    socket.on('connect', () => {
      console.log('[Socket.IO] Connected to realtime server');
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket.IO] Disconnected:', reason);
    });

    socketRef.current = socket;

    socket.emit('join_event', {
      eventId,
      user: { name: 'Live Viewer', role: 'VIEWER' }
    });

    // Real-time director camera switch event
    socket.on('camera_switched', (data) => {
      if (data.eventId === eventId) {
        setSelectedCameraId(data.activeCameraId);
        if (data.activeCameraName) {
          setSwitchingCameraName(data.activeCameraName);
        }

        // In Director-Controlled mode, immediately update program feed without reloading page
        if (cameraMode === 'DIRECTOR_CONTROLLED' && data.hlsMasterUrl) {
          loadStreamSource(data.hlsMasterUrl, activeStreamToken, data.activeCameraId);
        }
      }
    });

    // Real-time operating mode change (Director vs Viewer-Selectable)
    socket.on('camera_mode_changed', (data) => {
      if (data.eventId === eventId) {
        setCameraMode(data.cameraMode);
      }
    });

    // Real-time camera status update (e.g. offline/online)
    socket.on('camera_status_changed', (data) => {
      if (data.eventId === eventId) {
        setCameras(prev =>
          prev.map(cam => (cam.id === data.cameraId ? { ...cam, status: data.status, fps: data.fps, bitrateKbps: data.bitrateKbps } : cam))
        );

        // If currently viewing a camera that just went offline, automatically trigger fallback
        if (data.status === 'OFFLINE' && data.cameraId === selectedCameraId) {
          handleOfflineFallback();
        }
      }
    });

    socket.on('camera_list_updated', () => {
      // Refresh camera list
      fetch(`/api/v1/cameras?eventId=${eventId}`)
        .then(res => res.json())
        .then(d => {
          if (d.cameras) setCameras(d.cameras);
        })
        .catch(() => {});
    });

    return () => {
      socket.disconnect();
    };
  }, [eventId, cameraMode, selectedCameraId, activeStreamToken]);

  // --------------------------------------------------------------------------
  // Core HLS Stream Loader with Timestamp & Audio Continuity
  // --------------------------------------------------------------------------
  const loadStreamSource = useCallback(
    (targetUrl: string, token?: string, cameraId?: string) => {
      const video = videoRef.current;
      if (!video) return;

      setIsLoading(true);
      setHasError(false);
      setFallbackNotice(null);

      // Preserve audio state across switches
      const currentVol = video.volume;
      const currentMuted = video.muted;
      const wasPlaying = !video.paused;

      // Preserve playback time for aligned multi-camera switching
      const targetTime = video.currentTime > 0 ? video.currentTime : 0;

      let effectiveUrl = targetUrl || streamUrl;
      if (!effectiveUrl) {
        setIsLoading(false);
        setHasError(true);
        setErrorMessage('Camera stream offline or awaiting broadcast.');
        return;
      }

      // Attach token and camera scope
      if (token && effectiveUrl.startsWith('/api') && !effectiveUrl.includes('token=')) {
        effectiveUrl += `${effectiveUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
        if (cameraId) {
          effectiveUrl += `&camera=${encodeURIComponent(cameraId)}`;
        }
      }

      if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          maxBufferLength: 15,
          liveSyncDurationCount: 3
        });

        hlsRef.current = hls;
        hls.loadSource(effectiveUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          setIsLoading(false);
          setIsSwitchingCamera(false);

          // Restore audio volume & mute state
          video.volume = currentVol;
          video.muted = currentMuted;

          // Align playback position to preserve timeline synchronization
          if (targetTime > 0 && !hls.config.liveSyncDurationCount) {
            video.currentTime = targetTime;
          }

          if (wasPlaying) {
            video.play().catch(() => {});
          }

          const levelNames = data.levels.map(l => `${l.height}p`);
          if (levelNames.length > 0) setQualities(levelNames);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.warn('HLS stream error event:', data.type, data.details);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                // Handle manifest or segment loading failure with backoff before fallback
                if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
                  manifestRetryCountRef.current += 1;
                  if (manifestRetryCountRef.current <= 2) {
                    console.warn(`[Player] Retrying manifest load (${manifestRetryCountRef.current}/2)...`);
                    setTimeout(() => hls.startLoad(), 800);
                  } else {
                    console.warn('[Player] Manifest load failed after retries, falling back to verified online camera.');
                    manifestRetryCountRef.current = 0;
                    handleOfflineFallback();
                  }
                } else if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR) {
                  // Segment failure: retry segment once, then recover
                  hls.startLoad();
                } else {
                  handleOfflineFallback();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                setHasError(true);
                setErrorMessage('Camera stream connection interrupted.');
                setIsSwitchingCamera(false);
                hls.destroy();
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = effectiveUrl;
        video.addEventListener('loadedmetadata', () => {
          setIsLoading(false);
          setIsSwitchingCamera(false);
          video.volume = currentVol;
          video.muted = currentMuted;
          if (wasPlaying) video.play().catch(() => {});
        });
      }
    },
    []
  );

  // Initialize HLS or YouTube player
  useEffect(() => {
    if (sourceMode !== 'hls') {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    loadStreamSource(currentStreamUrl, activeStreamToken, selectedCameraId);

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [sourceMode, currentStreamUrl, loadStreamSource]);

  // --------------------------------------------------------------------------
  // Camera Switching (Mode B: Viewer-Selectable Camera Mode)
  // --------------------------------------------------------------------------
  const switchCameraAngle = async (targetCamera: PublicCameraFeed) => {
    if (targetCamera.id === selectedCameraId || isSwitchingCamera) return;

    // Check if target camera is marked OFFLINE
    if (targetCamera.status === 'OFFLINE') {
      setFallbackNotice(`"${targetCamera.name}" is currently offline. Playing default camera.`);
      setTimeout(() => setFallbackNotice(null), 4000);
      return;
    }

    if (!ticketCode) {
      setFallbackNotice('Valid ticket pass required to switch camera feeds.');
      setTimeout(() => setFallbackNotice(null), 4000);
      return;
    }

    setIsSwitchingCamera(true);
    setSwitchingCameraName(targetCamera.name);
    setFallbackNotice(null);

    try {
      // Call token authorization endpoint to scope token to the new camera and preserve ticket session
      const res = await fetch('/api/v1/streams/switch-camera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ticketCode,
          eventId,
          cameraId: targetCamera.id
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to authorize camera switch.');
      }

      const data = await res.json();
      const newCameraToken = data.token;
      const targetHlsUrl = data.activeCamera?.hlsMasterUrl || targetCamera.hlsMasterUrl;

      setActiveStreamToken(newCameraToken);
      setSelectedCameraId(targetCamera.id);
      setCurrentStreamUrl(targetHlsUrl);

      // Seamlessly transition stream in the existing player
      loadStreamSource(targetHlsUrl, newCameraToken, targetCamera.id);

      if (onCameraChange) {
        onCameraChange(targetCamera.id);
      }
    } catch (err: any) {
      console.warn('Camera switch error, falling back to default:', err);
      handleOfflineFallback();
    }
  };

  // Infinite fallback loop prevention guards
  const fallbackAttemptsRef = useRef<number>(0);
  const lastFallbackTimeRef = useRef<number>(0);
  const manifestRetryCountRef = useRef<number>(0);

  // Fallback to verified online camera (Camera 1 / Main Stage)
  const handleOfflineFallback = useCallback(() => {
    const now = Date.now();
    if (now - lastFallbackTimeRef.current < 6000) {
      fallbackAttemptsRef.current += 1;
    } else {
      fallbackAttemptsRef.current = 1;
    }
    lastFallbackTimeRef.current = now;

    // Prevent infinite switching loop
    if (fallbackAttemptsRef.current > 2) {
      console.warn('[Player] Fallback loop throttled (>2 attempts in 6s). Halting automated switching to prevent loop.');
      setHasError(true);
      setErrorMessage('Stage camera signals temporarily reconnecting. Please click Retry.');
      setIsLoading(false);
      setIsSwitchingCamera(false);
      return;
    }

    // Crucial check: verify that the fallback candidate is ACTUALLY online before switching
    const verifiedOnlineFallback =
      cameras.find(c => c.isDefault && c.status === 'LIVE' && c.id !== selectedCameraId) ||
      cameras.find(c => c.status === 'LIVE' && c.id !== selectedCameraId);

    if (verifiedOnlineFallback) {
      setFallbackNotice(`Camera angle unavailable. Falling back to online default "${verifiedOnlineFallback.name}".`);
      setSelectedCameraId(verifiedOnlineFallback.id);
      setCurrentStreamUrl(verifiedOnlineFallback.hlsMasterUrl);
      loadStreamSource(verifiedOnlineFallback.hlsMasterUrl, activeStreamToken, verifiedOnlineFallback.id);
      setTimeout(() => setFallbackNotice(null), 5000);
    } else {
      // All cameras are offline: Halt loop cleanly
      console.warn('[Player] All camera feeds are currently offline. Showing reconnecting screen.');
      setHasError(true);
      setErrorMessage('All concert stage cameras are currently offline or reconnecting.');
      setIsLoading(false);
      setIsSwitchingCamera(false);
    }
  }, [cameras, selectedCameraId, activeStreamToken, loadStreamSource]);

  // --------------------------------------------------------------------------
  // Jittered Heartbeat Reporting
  // --------------------------------------------------------------------------
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const getRandomJitteredInterval = () => 28000 + Math.random() * 6000;

    const pulseHeartbeat = () => {
      if (onHeartbeat) onHeartbeat();
      if (activeStreamToken) {
        fetch('/api/v1/streams/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streamToken: activeStreamToken,
            bitrateKbps: 4500,
            cameraId: selectedCameraId
          })
        }).catch(() => {});
      }
      timer = setTimeout(pulseHeartbeat, getRandomJitteredInterval());
    };

    timer = setTimeout(pulseHeartbeat, getRandomJitteredInterval());
    return () => clearTimeout(timer);
  }, [activeStreamToken, selectedCameraId, onHeartbeat]);

  // Video Controls
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
    loadStreamSource(currentStreamUrl, activeStreamToken, selectedCameraId);
  };

  const activeCameraObj = cameras.find(c => c.id === selectedCameraId) || cameras[0];

  return (
    <div className="flex flex-col w-full">
      {/* 1. Multi-Camera Selection Bar (Touch-Optimized, Displayed Directly Above Video) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 bg-surface-raised border-t sm:border-t-0 sm:border-x border-b border-line text-xs rounded-t-2xl">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center gap-1.5 text-polo-red font-black uppercase tracking-wider shrink-0 text-[11px]">
            <Video className="size-3.5" />
            <span>Camera Angle:</span>
          </div>

          {/* Mode B: Viewer-Selectable Camera Angle Buttons */}
          {cameraMode === 'VIEWER_SELECTABLE' ? (
            <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label="Camera angles">
              {cameras.map((cam) => {
                const isActive = cam.id === selectedCameraId;
                const isOffline = cam.status === 'OFFLINE';

                return (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => switchCameraAngle(cam)}
                    disabled={isSwitchingCamera || isOffline}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shrink-0 transition-all ${
                      isActive
                        ? 'bg-polo-red text-white shadow-md shadow-polo-red/30 scale-102 ring-1 ring-white/20'
                        : isOffline
                        ? 'bg-surface border border-line/40 text-neutral-500 cursor-not-allowed opacity-60'
                        : 'bg-surface border border-line text-neutral-300 hover:text-white hover:border-polo-red/50 active:scale-95'
                    }`}
                    title={cam.description || cam.name}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        isActive
                          ? 'bg-white animate-pulse'
                          : isOffline
                          ? 'bg-neutral-600'
                          : 'bg-emerald-400'
                      }`}
                    />
                    <span>{cam.name}</span>
                    {isOffline && <span className="text-[9px] text-neutral-500 lowercase">(offline)</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Mode A: Director-Controlled Mode Indicator */
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-polo-red/40 text-neutral-200 text-[11px] font-bold">
              <Clapperboard className="size-3.5 text-polo-red animate-pulse" />
              <span>Director's Cut Live:</span>
              <span className="text-white font-extrabold">{activeCameraObj?.name || 'Main Stage'}</span>
              <span className="text-[10px] text-muted font-normal hidden md:inline">
                (Production feed synchronized)
              </span>
            </div>
          )}
        </div>

        {/* Operating Mode Status Pill */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
            <Layers className="size-3 text-polo-red" />
            {cameraMode === 'VIEWER_SELECTABLE' ? 'Viewer Choice' : 'Director Cut'}
          </span>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Master Audio Mix
          </span>
        </div>
      </div>

      {/* 2. Video Container (16:9 Aspect Ratio) */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onTouchStart={() => setControlsVisible(true)}
        className="relative aspect-video w-full overflow-hidden bg-black shadow-2xl select-none group border-b sm:border border-line"
      >
        {/* YouTube Live Feed Embed */}
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
          /* Low-Latency Multi-Camera HLS Video Player */
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

            {/* Seamless Camera Switching Transition Spinner */}
            {isSwitchingCamera && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20 transition-opacity">
                <RefreshCw className="size-8 sm:size-10 text-polo-red animate-spin mb-3" />
                <span className="text-xs font-bold text-white tracking-wider uppercase">
                  Switching Angle to {switchingCameraName}...
                </span>
                <span className="text-[11px] text-muted mt-1">Preserving Shared Master Audio</span>
              </div>
            )}

            {/* General Loading Indicator */}
            {isLoading && !isSwitchingCamera && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-20">
                <RefreshCw className="size-8 sm:size-10 text-polo-red animate-spin mb-3" />
                <span className="text-xs font-bold text-white tracking-wider uppercase">
                  Connecting to {activeCameraObj?.name || 'Stage'} Feed...
                </span>
              </div>
            )}

            {/* Fallback Notice Toast */}
            {fallbackNotice && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-surface/95 border border-polo-red px-4 py-2 text-xs font-bold text-white shadow-2xl backdrop-blur-md animate-bounce">
                <AlertCircle className="size-4 text-polo-red shrink-0" />
                <span>{fallbackNotice}</span>
              </div>
            )}

            {/* Error Reconnect Screen */}
            {hasError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 p-6 text-center">
                <AlertCircle className="size-10 sm:size-12 text-polo-red mb-3" />
                <h3 className="text-sm sm:text-base font-bold text-white mb-1">Broadcast Signal Reconnecting</h3>
                <p className="text-xs text-muted max-w-md mb-4">{errorMessage}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={retryPlayback}
                    className="inline-flex items-center gap-2 rounded-full bg-polo-red px-5 py-2 text-xs font-bold text-white hover:bg-polo-red-dark transition-all"
                  >
                    <RefreshCw className="size-3.5" />
                    <span>Retry Camera Feed</span>
                  </button>
                  <button
                    onClick={handleOfflineFallback}
                    className="inline-flex items-center gap-2 rounded-full bg-surface-raised border border-line px-5 py-2 text-xs font-bold text-white hover:border-polo-red transition-all"
                  >
                    <span>Switch to Main Stage</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Controls Bar */}
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
                {/* Active Angle Badge inside controls */}
                <span className="text-[10px] font-bold text-neutral-300 bg-white/10 px-2 py-0.5 rounded-md hidden md:inline">
                  {activeCameraObj?.name || 'Main Stage'}
                </span>

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
          <span className="text-[11px] font-bold text-white/90 drop-shadow hidden xs:inline truncate max-w-[180px]">
            {eventName}
          </span>
          <span className="text-[10px] font-semibold text-white/80 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10 hidden sm:inline">
            Angle: {activeCameraObj?.name || 'Main Stage'}
          </span>
        </div>
      </div>

      {/* 3. Stream Source Pipeline Bar (YouTube vs Low-Latency HLS) */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface border-b border-line text-xs rounded-b-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[10px] uppercase font-black text-muted tracking-wider mr-1 shrink-0">
            Pipeline:
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
            <span>YouTube Showcase</span>
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
            <span>SRS Production Multi-Cam</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            1080p60 Synchronized
          </span>
        </div>
      </div>
    </div>
  );
}
