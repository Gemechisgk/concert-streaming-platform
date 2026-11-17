import crypto from 'node:crypto';
import {
  StreamChannel,
  PlaybackSession,
  StreamQualityProfile,
  CameraFeed,
  PublicCameraFeed,
  CameraOperatingMode,
  CameraStatus,
  IngestProtocol
} from '@concert/types';
import { AppError, createStreamToken, verifyStreamToken } from '@concert/shared';
import { TicketService } from './ticket.service';

const STREAM_SIGNING_KEY =
  process.env.STREAM_SIGNING_PRIVATE_KEY ||
  process.env.JWT_SECRET ||
  'development_jwt_secret_test_key_min_32_chars';
const STREAM_VERIFICATION_KEY = process.env.STREAM_SIGNING_PUBLIC_KEY || STREAM_SIGNING_KEY;
const SRS_STREAM_KEY = process.env.SRS_STREAM_KEY || 'dev_rehearsal_primary_stream_key';
const SRS_BACKUP_STREAM_KEY = process.env.SRS_BACKUP_STREAM_KEY || 'dev_rehearsal_backup_stream_key';

// Active in-memory playback sessions to enforce single active session policy per ticket
let activeSessions: Map<string, PlaybackSession> = new Map();
// O(1) reverse lookup map: ticketId -> streamToken for instantaneous duplicate session eviction at 50,000+ concurrency
let ticketToSessionToken: Map<string, string> = new Map();

// Event listeners for real-time WebSocket fanout
type CameraEventListener = (event: string, data: any) => void;
const cameraEventListeners: Set<CameraEventListener> = new Set();

// Periodic prune of expired sessions (every 60s) to keep memory bounded at high scale
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (new Date(session.expiresAt).getTime() < now) {
      activeSessions.delete(token);
      ticketToSessionToken.delete(session.ticketId);
    }
  }
}, 60000).unref?.();

// Helper to create quality profiles
function createStandardABRProfiles(baseMasterUrl: string): StreamQualityProfile[] {
  const isCdn = baseMasterUrl.startsWith('/api/v1/cdn/live/abr');
  if (isCdn) {
    return [
      { name: '1080p', bitrateKbps: 4500, resolution: '1920x1080', playlistUrl: '/api/v1/cdn/live/abr/stream_1080p.m3u8' },
      { name: '720p', bitrateKbps: 2500, resolution: '1280x720', playlistUrl: '/api/v1/cdn/live/abr/stream_720p.m3u8' },
      { name: '480p', bitrateKbps: 1000, resolution: '854x480', playlistUrl: '/api/v1/cdn/live/abr/stream_480p.m3u8' },
      { name: '360p', bitrateKbps: 600, resolution: '640x360', playlistUrl: '/api/v1/cdn/live/abr/stream_360p.m3u8' },
      { name: 'Auto', bitrateKbps: 4500, resolution: 'Adaptive ABR', playlistUrl: baseMasterUrl }
    ];
  }
  return [
    { name: '1080p', bitrateKbps: 4500, resolution: '1920x1080', playlistUrl: 'https://test-streams.mux.dev/x36xhzz/url_0/1920x1080/index.m3u8' },
    { name: '720p', bitrateKbps: 2500, resolution: '1280x720', playlistUrl: 'https://test-streams.mux.dev/x36xhzz/url_2/1280x720/index.m3u8' },
    { name: '480p', bitrateKbps: 1000, resolution: '854x480', playlistUrl: 'https://test-streams.mux.dev/x36xhzz/url_4/854x480/index.m3u8' },
    { name: '360p', bitrateKbps: 600, resolution: '640x360', playlistUrl: 'https://test-streams.mux.dev/x36xhzz/url_6/640x360/index.m3u8' },
    { name: 'Auto', bitrateKbps: 4500, resolution: 'Adaptive ABR', playlistUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' }
  ];
}

// Helper to seed multi-camera angles for an event
function createDefaultCameras(eventId: string, channelId: string, isRehearsal: boolean = false): CameraFeed[] {
  if (isRehearsal) {
    return [
      {
        id: `cam_${eventId}_1`,
        eventId,
        streamChannelId: channelId,
        name: 'Main Stage',
        description: 'Wide master stage camera capturing the full band performance',
        cameraIndex: 0,
        streamKey: SRS_STREAM_KEY,
        backupStreamKey: SRS_BACKUP_STREAM_KEY,
        ingestProtocol: 'RTMP',
        rtmpIngestUrl: `rtmp://origin.feshtafest.com:1935/live/${SRS_STREAM_KEY}`,
        srtIngestUrl: `srt://origin.feshtafest.com:10080?streamid=#!::r=live/${SRS_STREAM_KEY},m=publish`,
        hlsMasterUrl: '/api/v1/cdn/live/abr/master.m3u8',
        isDefault: true,
        isActiveLive: true,
        status: 'LIVE',
        fps: 60,
        bitrateKbps: 4500,
        dropFrames: 0,
        qualities: createStandardABRProfiles('/api/v1/cdn/live/abr/master.m3u8')
      },
      {
        id: `cam_${eventId}_2`,
        eventId,
        streamChannelId: channelId,
        name: 'Front Close-up',
        description: 'Tight framing on lead vocalist and center soloists',
        cameraIndex: 1,
        streamKey: 'srs_rehearsal_cam_closeup_key',
        backupStreamKey: 'srs_rehearsal_cam_closeup_key_back',
        ingestProtocol: 'RTMP',
        rtmpIngestUrl: 'rtmp://origin.feshtafest.com:1935/live/srs_rehearsal_cam_closeup_key',
        srtIngestUrl: 'srt://origin.feshtafest.com:10080?streamid=#!::r=live/srs_rehearsal_cam_closeup_key,m=publish',
        hlsMasterUrl: '/api/v1/cdn/live/abr/master.m3u8',
        isDefault: false,
        isActiveLive: false,
        status: 'LIVE',
        fps: 60,
        bitrateKbps: 4500,
        dropFrames: 0,
        qualities: createStandardABRProfiles('/api/v1/cdn/live/abr/master.m3u8')
      },
      {
        id: `cam_${eventId}_3`,
        eventId,
        streamChannelId: channelId,
        name: 'Side Stage',
        description: 'Profile angle showing keyboardists, percussion, and guitarists',
        cameraIndex: 2,
        streamKey: 'srs_rehearsal_cam_sidestage_key',
        backupStreamKey: 'srs_rehearsal_cam_sidestage_key_back',
        ingestProtocol: 'SRT',
        rtmpIngestUrl: 'rtmp://origin.feshtafest.com:1935/live/srs_rehearsal_cam_sidestage_key',
        srtIngestUrl: 'srt://origin.feshtafest.com:10080?streamid=#!::r=live/srs_rehearsal_cam_sidestage_key,m=publish',
        hlsMasterUrl: '/api/v1/cdn/live/abr/master.m3u8',
        isDefault: false,
        isActiveLive: false,
        status: 'LIVE',
        fps: 60,
        bitrateKbps: 4500,
        dropFrames: 0,
        qualities: createStandardABRProfiles('/api/v1/cdn/live/abr/master.m3u8')
      },
      {
        id: `cam_${eventId}_4`,
        eventId,
        streamChannelId: channelId,
        name: 'Audience',
        description: 'Atmospheric wide angle of crowd energy and venue lights',
        cameraIndex: 3,
        streamKey: 'srs_rehearsal_cam_audience_key',
        backupStreamKey: 'srs_rehearsal_cam_audience_key_back',
        ingestProtocol: 'RTMP',
        rtmpIngestUrl: 'rtmp://origin.feshtafest.com:1935/live/srs_rehearsal_cam_audience_key',
        srtIngestUrl: 'srt://origin.feshtafest.com:10080?streamid=#!::r=live/srs_rehearsal_cam_audience_key,m=publish',
        hlsMasterUrl: '/api/v1/cdn/live/abr/master.m3u8',
        isDefault: false,
        isActiveLive: false,
        status: 'LIVE',
        fps: 60,
        bitrateKbps: 4500,
        dropFrames: 0,
        qualities: createStandardABRProfiles('/api/v1/cdn/live/abr/master.m3u8')
      }
    ];
  }

  return [
    {
      id: `cam_${eventId}_1`,
      eventId,
      streamChannelId: channelId,
      name: 'Main Stage',
      description: 'Wide master stage view of the entire concert performance',
      cameraIndex: 0,
      streamKey: `live_${eventId}_cam1_${crypto.randomBytes(4).toString('hex')}`,
      backupStreamKey: `live_${eventId}_cam1_back_${crypto.randomBytes(4).toString('hex')}`,
      ingestProtocol: 'RTMP',
      rtmpIngestUrl: `rtmp://origin.feshtafest.com:1935/live/live_${eventId}_cam1`,
      srtIngestUrl: `srt://origin.feshtafest.com:10080?streamid=#!::r=live/live_${eventId}_cam1,m=publish`,
      hlsMasterUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      isDefault: true,
      isActiveLive: true,
      status: 'LIVE',
      fps: 59.94,
      bitrateKbps: 4800,
      dropFrames: 0,
      qualities: createStandardABRProfiles('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8')
    },
    {
      id: `cam_${eventId}_2`,
      eventId,
      streamChannelId: channelId,
      name: 'Front Close-up',
      description: 'Direct high-detail shot on the vocalist',
      cameraIndex: 1,
      streamKey: `live_${eventId}_cam2_${crypto.randomBytes(4).toString('hex')}`,
      backupStreamKey: `live_${eventId}_cam2_back_${crypto.randomBytes(4).toString('hex')}`,
      ingestProtocol: 'RTMP',
      rtmpIngestUrl: `rtmp://origin.feshtafest.com:1935/live/live_${eventId}_cam2`,
      srtIngestUrl: `srt://origin.feshtafest.com:10080?streamid=#!::r=live/live_${eventId}_cam2,m=publish`,
      hlsMasterUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      isDefault: false,
      isActiveLive: false,
      status: 'LIVE',
      fps: 59.94,
      bitrateKbps: 4800,
      dropFrames: 0,
      qualities: createStandardABRProfiles('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8')
    },
    {
      id: `cam_${eventId}_3`,
      eventId,
      streamChannelId: channelId,
      name: 'Side Stage',
      description: 'Side stage perspective featuring rhythm section and backing artists',
      cameraIndex: 2,
      streamKey: `live_${eventId}_cam3_${crypto.randomBytes(4).toString('hex')}`,
      backupStreamKey: `live_${eventId}_cam3_back_${crypto.randomBytes(4).toString('hex')}`,
      ingestProtocol: 'SRT',
      rtmpIngestUrl: `rtmp://origin.feshtafest.com:1935/live/live_${eventId}_cam3`,
      srtIngestUrl: `srt://origin.feshtafest.com:10080?streamid=#!::r=live/live_${eventId}_cam3,m=publish`,
      hlsMasterUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      isDefault: false,
      isActiveLive: false,
      status: 'LIVE',
      fps: 59.94,
      bitrateKbps: 4800,
      dropFrames: 0,
      qualities: createStandardABRProfiles('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8')
    },
    {
      id: `cam_${eventId}_4`,
      eventId,
      streamChannelId: channelId,
      name: 'Audience',
      description: 'Stadium crowd angle highlighting attendee reactions',
      cameraIndex: 3,
      streamKey: `live_${eventId}_cam4_${crypto.randomBytes(4).toString('hex')}`,
      backupStreamKey: `live_${eventId}_cam4_back_${crypto.randomBytes(4).toString('hex')}`,
      ingestProtocol: 'RTMP',
      rtmpIngestUrl: `rtmp://origin.feshtafest.com:1935/live/live_${eventId}_cam4`,
      srtIngestUrl: `srt://origin.feshtafest.com:10080?streamid=#!::r=live/live_${eventId}_cam4,m=publish`,
      hlsMasterUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      isDefault: false,
      isActiveLive: false,
      status: 'LIVE',
      fps: 59.94,
      bitrateKbps: 4800,
      dropFrames: 0,
      qualities: createStandardABRProfiles('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8')
    }
  ];
}

// Mock Stream Channels with Multi-Camera Configurations
let mockChannels: Record<string, StreamChannel> = {
  evt_veronica_01: {
    id: 'ch_veronica_01',
    eventId: 'evt_veronica_01',
    status: 'LIVE',
    cameraMode: 'VIEWER_SELECTABLE',
    activeCameraId: 'cam_evt_veronica_01_1',
    cameras: createDefaultCameras('evt_veronica_01', 'ch_veronica_01', false),
    hlsMasterUrl: 'https://www.youtube.com/watch?v=mSrVwIRKASI',
    youtubeVideoUrl: 'https://www.youtube.com/watch?v=mSrVwIRKASI',
    fallbackMp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    qualities: createStandardABRProfiles('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
    primaryIngestRtmp: 'rtmp://127.0.0.1:1935/live/' + SRS_STREAM_KEY,
    backupIngestRtmp: 'rtmp://127.0.0.1:1935/live/' + SRS_BACKUP_STREAM_KEY,
    streamKey: SRS_STREAM_KEY,
    fps: 59.94,
    currentBitrateKbps: 4800,
    dropFrames: 0
  },
  evt_teddy_afro_01: {
    id: 'ch_teddy_01',
    eventId: 'evt_teddy_afro_01',
    status: 'LIVE',
    cameraMode: 'DIRECTOR_CONTROLLED',
    activeCameraId: 'cam_evt_teddy_afro_01_1',
    cameras: createDefaultCameras('evt_teddy_afro_01', 'ch_teddy_01', false),
    hlsMasterUrl: 'https://www.youtube.com/watch?v=mSrVwIRKASI',
    youtubeVideoUrl: 'https://www.youtube.com/watch?v=mSrVwIRKASI',
    fallbackMp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    qualities: createStandardABRProfiles('https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'),
    primaryIngestRtmp: 'rtmp://127.0.0.1:1935/live/' + SRS_STREAM_KEY,
    backupIngestRtmp: 'rtmp://127.0.0.1:1935/live/' + SRS_BACKUP_STREAM_KEY,
    streamKey: SRS_STREAM_KEY,
    fps: 59.94,
    currentBitrateKbps: 4800,
    dropFrames: 0
  },
  evt_rophnan_02: {
    id: 'ch_rophnan_02',
    eventId: 'evt_rophnan_02',
    status: 'OFFLINE',
    cameraMode: 'DIRECTOR_CONTROLLED',
    activeCameraId: 'cam_evt_rophnan_02_1',
    cameras: createDefaultCameras('evt_rophnan_02', 'ch_rophnan_02', false).map(c => ({
      ...c,
      status: 'OFFLINE',
      bitrateKbps: 0
    })),
    hlsMasterUrl: '/api/v1/cdn/live/abr/master.m3u8',
    qualities: [],
    primaryIngestRtmp: 'rtmp://127.0.0.1:1935/live/' + SRS_STREAM_KEY,
    backupIngestRtmp: 'rtmp://127.0.0.1:1935/live/' + SRS_BACKUP_STREAM_KEY,
    streamKey: SRS_STREAM_KEY,
    fps: 60,
    currentBitrateKbps: 0,
    dropFrames: 0
  },
  evt_srs_rehearsal_04: {
    id: 'ch_srs_rehearsal_04',
    eventId: 'evt_srs_rehearsal_04',
    status: 'LIVE',
    cameraMode: 'VIEWER_SELECTABLE',
    activeCameraId: 'cam_evt_srs_rehearsal_04_1',
    cameras: createDefaultCameras('evt_srs_rehearsal_04', 'ch_srs_rehearsal_04', true),
    hlsMasterUrl: '/api/v1/cdn/live/abr/master.m3u8',
    qualities: createStandardABRProfiles('/api/v1/cdn/live/abr/master.m3u8'),
    primaryIngestRtmp: 'rtmp://127.0.0.1:1935/live/' + SRS_STREAM_KEY,
    backupIngestRtmp: 'rtmp://127.0.0.1:1935/live/' + SRS_BACKUP_STREAM_KEY,
    streamKey: SRS_STREAM_KEY,
    fps: 60,
    currentBitrateKbps: 4500,
    dropFrames: 0
  }
};

export class StreamService {
  // --------------------------------------------------------------------------
  // Real-Time Event Bus for Socket.IO Subscriptions
  // --------------------------------------------------------------------------
  static onCameraEvent(listener: CameraEventListener): () => void {
    cameraEventListeners.add(listener);
    return () => {
      cameraEventListeners.delete(listener);
    };
  }

  static emitCameraEvent(event: string, data: any): void {
    for (const listener of cameraEventListeners) {
      try {
        listener(event, data);
      } catch (err) {
        console.error(`[StreamService] Error executing camera event listener for ${event}:`, err);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Channel & Camera Discovery
  // --------------------------------------------------------------------------
  static getChannelByEventId(eventId: string): StreamChannel | null {
    if (eventId === 'evt_teddy_afro_01' || eventId === 'teddy-afro-live-in-addis') {
      return mockChannels['evt_teddy_afro_01'] || mockChannels['evt_veronica_01'];
    }
    return mockChannels[eventId] ?? mockChannels['evt_veronica_01'] ?? null;
  }

  static getCamerasByEventId(eventId: string): CameraFeed[] {
    const channel = this.getChannelByEventId(eventId);
    if (!channel || !channel.cameras) return [];
    return channel.cameras;
  }

  /**
   * Sanitized public camera feed list for viewers.
   * Strips secret publishing keys and internal ingest URLs to prevent unauthorized broadcasts.
   */
  static getPublicCamerasByEventId(eventId: string): PublicCameraFeed[] {
    const cameras = this.getCamerasByEventId(eventId);
    return cameras.map(cam => ({
      id: cam.id,
      eventId: cam.eventId,
      name: cam.name,
      description: cam.description,
      cameraIndex: cam.cameraIndex,
      hlsMasterUrl: cam.hlsMasterUrl,
      isDefault: cam.isDefault,
      isActiveLive: cam.isActiveLive,
      status: cam.status,
      fps: cam.fps,
      bitrateKbps: cam.bitrateKbps,
      qualities: cam.qualities
    }));
  }

  static getCameraById(eventId: string, cameraId: string): CameraFeed | null {
    const cameras = this.getCamerasByEventId(eventId);
    return cameras.find(c => c.id === cameraId) || null;
  }

  static getDefaultCamera(eventId: string): CameraFeed | null {
    const cameras = this.getCamerasByEventId(eventId);
    return cameras.find(c => c.isDefault) || cameras[0] || null;
  }

  static getActiveLiveCamera(eventId: string): CameraFeed | null {
    const channel = this.getChannelByEventId(eventId);
    if (!channel) return null;
    const cameras = channel.cameras || [];
    if (channel.activeCameraId) {
      const active = cameras.find(c => c.id === channel.activeCameraId);
      if (active) return active;
    }
    return cameras.find(c => c.isActiveLive) || cameras.find(c => c.isDefault) || cameras[0] || null;
  }

  // --------------------------------------------------------------------------
  // Camera Management (Admin & Production Operators)
  // --------------------------------------------------------------------------
  static addCamera(
    eventId: string,
    input: {
      name: string;
      description?: string;
      isDefault?: boolean;
      ingestProtocol?: IngestProtocol;
    }
  ): CameraFeed {
    const channel = this.getChannelByEventId(eventId);
    if (!channel) {
      throw new AppError(`Stream channel not found for event ${eventId}`, 404, 'CHANNEL_NOT_FOUND');
    }

    if (!channel.cameras) {
      channel.cameras = [];
    }

    const cameraId = `cam_${eventId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const streamKey = `live_${eventId}_${crypto.randomBytes(8).toString('hex')}`;
    const backupStreamKey = `live_${eventId}_back_${crypto.randomBytes(8).toString('hex')}`;
    const protocol: IngestProtocol = input.ingestProtocol || 'RTMP';
    const isFirstCamera = channel.cameras.length === 0;
    const isDefault = input.isDefault ?? isFirstCamera;

    if (isDefault) {
      // Clear default flag on existing cameras
      for (const cam of channel.cameras) {
        cam.isDefault = false;
      }
    }

    const newCamera: CameraFeed = {
      id: cameraId,
      eventId,
      streamChannelId: channel.id,
      name: input.name,
      description: input.description,
      cameraIndex: channel.cameras.length,
      streamKey,
      backupStreamKey,
      ingestProtocol: protocol,
      rtmpIngestUrl: `rtmp://origin.feshtafest.com:1935/live/${streamKey}`,
      srtIngestUrl: `srt://origin.feshtafest.com:10080?streamid=#!::r=live/${streamKey},m=publish`,
      hlsMasterUrl: channel.hlsMasterUrl,
      isDefault,
      isActiveLive: isFirstCamera,
      status: 'OFFLINE',
      fps: 60,
      bitrateKbps: 4500,
      dropFrames: 0,
      qualities: channel.qualities,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    channel.cameras.push(newCamera);
    if (isFirstCamera && !channel.activeCameraId) {
      channel.activeCameraId = cameraId;
    }

    this.emitCameraEvent('camera_list_updated', {
      eventId,
      action: 'ADDED',
      camera: newCamera
    });

    return newCamera;
  }

  static removeCamera(eventId: string, cameraId: string): boolean {
    const channel = this.getChannelByEventId(eventId);
    if (!channel || !channel.cameras) {
      throw new AppError(`Event or cameras not found`, 404, 'NOT_FOUND');
    }

    const index = channel.cameras.findIndex(c => c.id === cameraId);
    if (index === -1) {
      throw new AppError(`Camera ${cameraId} not found`, 404, 'CAMERA_NOT_FOUND');
    }

    const [removed] = channel.cameras.splice(index, 1);

    // If removed camera was default, promote first remaining camera
    if (removed.isDefault && channel.cameras.length > 0) {
      channel.cameras[0].isDefault = true;
    }

    // If removed camera was active live, promote default
    if (channel.activeCameraId === cameraId && channel.cameras.length > 0) {
      const newActive = channel.cameras.find(c => c.isDefault) || channel.cameras[0];
      channel.activeCameraId = newActive.id;
      newActive.isActiveLive = true;
    }

    this.emitCameraEvent('camera_list_updated', {
      eventId,
      action: 'REMOVED',
      cameraId
    });

    return true;
  }

  static updateCamera(
    eventId: string,
    cameraId: string,
    data: Partial<Omit<CameraFeed, 'id' | 'eventId' | 'streamKey' | 'backupStreamKey'>>
  ): CameraFeed {
    const camera = this.getCameraById(eventId, cameraId);
    if (!camera) {
      throw new AppError(`Camera ${cameraId} not found`, 404, 'CAMERA_NOT_FOUND');
    }

    const channel = this.getChannelByEventId(eventId);

    if (data.isDefault && channel?.cameras) {
      for (const c of channel.cameras) {
        c.isDefault = c.id === cameraId;
      }
    }

    const prevStatus = camera.status;
    Object.assign(camera, data, { updatedAt: new Date().toISOString() });

    if (data.status && data.status !== prevStatus) {
      this.emitCameraEvent('camera_status_changed', {
        eventId,
        cameraId,
        cameraName: camera.name,
        status: camera.status,
        fps: camera.fps,
        bitrateKbps: camera.bitrateKbps
      });
    }

    this.emitCameraEvent('camera_list_updated', {
      eventId,
      action: 'UPDATED',
      camera
    });

    return camera;
  }

  static setDefaultCamera(eventId: string, cameraId: string): CameraFeed {
    return this.updateCamera(eventId, cameraId, { isDefault: true });
  }

  // --------------------------------------------------------------------------
  // Operating Modes: Director-Controlled vs Viewer-Selectable
  // --------------------------------------------------------------------------
  static setCameraMode(eventId: string, mode: CameraOperatingMode): CameraOperatingMode {
    const channel = this.getChannelByEventId(eventId);
    if (!channel) {
      throw new AppError(`Channel not found for event ${eventId}`, 404, 'CHANNEL_NOT_FOUND');
    }

    channel.cameraMode = mode;
    this.emitCameraEvent('camera_mode_changed', {
      eventId,
      cameraMode: mode,
      activeCameraId: channel.activeCameraId
    });

    return mode;
  }

  /**
   * Mode A: Director switches live camera.
   * Updates channel activeCameraId and broadcasts camera_switched to all connected viewers.
   */
  static switchDirectorCamera(
    eventId: string,
    cameraId: string,
    operatorUserId?: string
  ): CameraFeed {
    const channel = this.getChannelByEventId(eventId);
    if (!channel || !channel.cameras) {
      throw new AppError(`Stream channel not found for event ${eventId}`, 404, 'CHANNEL_NOT_FOUND');
    }

    const targetCamera = channel.cameras.find(c => c.id === cameraId);
    if (!targetCamera) {
      throw new AppError(`Camera ${cameraId} does not belong to event ${eventId}`, 404, 'CAMERA_NOT_FOUND');
    }

    channel.activeCameraId = cameraId;
    for (const c of channel.cameras) {
      c.isActiveLive = c.id === cameraId;
    }

    this.emitCameraEvent('camera_switched', {
      eventId,
      activeCameraId: targetCamera.id,
      activeCameraName: targetCamera.name,
      cameraIndex: targetCamera.cameraIndex,
      hlsMasterUrl: targetCamera.hlsMasterUrl,
      operatorUserId: operatorUserId || 'director',
      timestamp: new Date().toISOString()
    });

    return targetCamera;
  }

  // --------------------------------------------------------------------------
  // Authorization & Viewer Session Management
  // --------------------------------------------------------------------------
  static authorizeStreamAccess(
    ticketCode: string,
    eventId: string,
    userId: string = 'viewer',
    requestedCameraId?: string
  ): {
    token: string;
    channel: StreamChannel;
    activeCamera: PublicCameraFeed;
    availableCameras: PublicCameraFeed[];
    cameraMode: CameraOperatingMode;
  } {
    const verification = TicketService.verifyTicketForEvent(ticketCode, eventId);
    if (!verification.valid || !verification.ticket) {
      throw new AppError(verification.reason || 'Invalid ticket code for this concert.', 403, 'INVALID_TICKET');
    }

    const channel = this.getChannelByEventId(eventId);
    if (!channel) {
      throw new AppError('Streaming channel for this concert is not initialized.', 404, 'CHANNEL_NOT_FOUND');
    }

    const cameraMode: CameraOperatingMode = channel.cameraMode || 'DIRECTOR_CONTROLLED';
    const cameras = channel.cameras || [];

    // Determine target camera based on mode & request
    let targetCamera: CameraFeed;

    if (cameraMode === 'VIEWER_SELECTABLE' && requestedCameraId) {
      const selected = cameras.find(c => c.id === requestedCameraId);
      if (!selected) {
        throw new AppError(`Selected camera ${requestedCameraId} does not exist for this concert.`, 404, 'CAMERA_NOT_FOUND');
      }

      // If requested camera is offline, fall back to default camera gracefully (ensuring candidate is online)
      if (selected.status === 'OFFLINE') {
        const fallback =
          cameras.find(c => c.isDefault && c.status === 'LIVE') ||
          cameras.find(c => c.status === 'LIVE') ||
          cameras.find(c => c.isDefault) ||
          cameras[0];
        targetCamera = fallback || selected;
      } else {
        targetCamera = selected;
      }
    } else {
      // In Director Mode or if no camera specified, use active director camera or default
      const active = this.getActiveLiveCamera(eventId);
      targetCamera = active || cameras[0];
    }

    // Single active stream session policy per ticket holder
    // Instantaneous O(1) eviction for 50,000+ concurrency
    const existingToken = ticketToSessionToken.get(verification.ticket.id);
    if (existingToken) {
      activeSessions.delete(existingToken);
      ticketToSessionToken.delete(verification.ticket.id);
    }

    // Generate signed token scoped to event AND target camera (RFC 7519 NumericDate)
    const streamToken = createStreamToken(
      verification.ticket.id,
      eventId,
      userId,
      STREAM_SIGNING_KEY,
      15 * 60,
      targetCamera?.id
    );

    const newSession: PlaybackSession = {
      sessionId: `sess_${Date.now()}`,
      ticketId: verification.ticket.id,
      userId,
      eventId,
      cameraId: targetCamera?.id,
      streamToken,
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      lastHeartbeat: new Date().toISOString()
    };

    activeSessions.set(streamToken, newSession);
    ticketToSessionToken.set(verification.ticket.id, streamToken);

    // Format authenticated HLS URLs with token
    const isCdnProxy = channel.hlsMasterUrl.startsWith('/api/v1/cdn/live');
    const authenticatedChannel: StreamChannel = isCdnProxy
      ? {
          ...channel,
          hlsMasterUrl: `${channel.hlsMasterUrl}?token=${encodeURIComponent(streamToken)}&camera=${encodeURIComponent(targetCamera.id)}`,
          qualities: channel.qualities.map(q => ({
            ...q,
            playlistUrl: `${q.playlistUrl}?token=${encodeURIComponent(streamToken)}&camera=${encodeURIComponent(targetCamera.id)}`
          }))
        }
      : channel;

    const publicTargetCamera: PublicCameraFeed = {
      id: targetCamera.id,
      eventId: targetCamera.eventId,
      name: targetCamera.name,
      description: targetCamera.description,
      cameraIndex: targetCamera.cameraIndex,
      hlsMasterUrl: isCdnProxy
        ? `${targetCamera.hlsMasterUrl}?token=${encodeURIComponent(streamToken)}&camera=${encodeURIComponent(targetCamera.id)}`
        : targetCamera.hlsMasterUrl,
      isDefault: targetCamera.isDefault,
      isActiveLive: targetCamera.isActiveLive,
      status: targetCamera.status,
      fps: targetCamera.fps,
      bitrateKbps: targetCamera.bitrateKbps,
      qualities: authenticatedChannel.qualities
    };

    const availableCameras = this.getPublicCamerasByEventId(eventId);

    return {
      token: streamToken,
      channel: authenticatedChannel,
      activeCamera: publicTargetCamera,
      availableCameras,
      cameraMode
    };
  }

  static recordHeartbeat(streamToken: string, cameraId?: string): boolean {
    const session = activeSessions.get(streamToken);
    if (!session) {
      return false;
    }

    const tokenCheck = verifyStreamToken(streamToken, STREAM_VERIFICATION_KEY, cameraId);
    if (!tokenCheck.valid) {
      activeSessions.delete(streamToken);
      ticketToSessionToken.delete(session.ticketId);
      return false;
    }

    session.lastHeartbeat = new Date().toISOString();
    return true;
  }

  // --------------------------------------------------------------------------
  // SRS HTTP Webhook Handlers (on_publish, on_unpublish, on_play)
  // --------------------------------------------------------------------------
  static handleSrsPublish(streamKey: string): {
    code: number;
    message: string;
    cameraId?: string;
    eventId?: string;
  } {
    if (!streamKey) {
      return { code: 1, message: 'Missing stream key' };
    }

    // 1. Check if streamKey matches any specific camera feed
    for (const channel of Object.values(mockChannels)) {
      if (channel.cameras) {
        const matchedCamera = channel.cameras.find(
          c =>
            c.streamKey === streamKey ||
            c.backupStreamKey === streamKey ||
            c.rtmpIngestUrl.endsWith(streamKey) ||
            (c.srtIngestUrl && c.srtIngestUrl.includes(streamKey))
        );

        if (matchedCamera) {
          matchedCamera.status = 'LIVE';
          channel.status = 'LIVE';

          this.emitCameraEvent('camera_status_changed', {
            eventId: channel.eventId,
            cameraId: matchedCamera.id,
            cameraName: matchedCamera.name,
            status: 'LIVE',
            fps: matchedCamera.fps,
            bitrateKbps: matchedCamera.bitrateKbps
          });

          return {
            code: 0,
            message: 'Stream authorized',
            cameraId: matchedCamera.id,
            eventId: channel.eventId
          };
        }
      }

      // 2. Fallback check for channel master/backup primary key
      if (
        channel.streamKey === streamKey ||
        channel.primaryIngestRtmp.endsWith(streamKey) ||
        channel.backupIngestRtmp.endsWith(streamKey)
      ) {
        channel.status = 'LIVE';
        // Also set default camera to LIVE if present
        if (channel.cameras && channel.cameras.length > 0) {
          const defaultCam = channel.cameras.find(c => c.isDefault) || channel.cameras[0];
          defaultCam.status = 'LIVE';
        }
        return { code: 0, message: 'Stream authorized', eventId: channel.eventId };
      }
    }

    return { code: 1, message: 'Unauthorized stream key' }; // SRS rejects push when code != 0
  }

  static handleSrsUnpublish(streamKey: string): {
    code: number;
    message: string;
    cameraId?: string;
    eventId?: string;
  } {
    if (!streamKey) {
      return { code: 0, message: 'Unpublish acknowledged' };
    }

    for (const channel of Object.values(mockChannels)) {
      if (channel.cameras) {
        const matchedCamera = channel.cameras.find(
          c =>
            c.streamKey === streamKey ||
            c.backupStreamKey === streamKey ||
            c.rtmpIngestUrl.endsWith(streamKey) ||
            (c.srtIngestUrl && c.srtIngestUrl.includes(streamKey))
        );

        if (matchedCamera) {
          matchedCamera.status = 'OFFLINE';

          this.emitCameraEvent('camera_status_changed', {
            eventId: channel.eventId,
            cameraId: matchedCamera.id,
            cameraName: matchedCamera.name,
            status: 'OFFLINE',
            fps: 0,
            bitrateKbps: 0
          });

          // If the disconnected camera was the active director camera, trigger fallback to default camera
          if (channel.activeCameraId === matchedCamera.id) {
            const fallback = channel.cameras.find(c => c.isDefault && c.id !== matchedCamera.id) ||
              channel.cameras.find(c => c.status === 'LIVE') ||
              channel.cameras[0];

            if (fallback && fallback.id !== matchedCamera.id) {
              channel.activeCameraId = fallback.id;
              fallback.isActiveLive = true;
              matchedCamera.isActiveLive = false;

              this.emitCameraEvent('camera_switched', {
                eventId: channel.eventId,
                activeCameraId: fallback.id,
                activeCameraName: fallback.name,
                reason: 'OFFLINE_FALLBACK',
                timestamp: new Date().toISOString()
              });
            }
          }

          // Check if all cameras are offline
          const anyLive = channel.cameras.some(c => c.status === 'LIVE');
          if (!anyLive) {
            channel.status = 'OFFLINE';
          }

          return {
            code: 0,
            message: 'Camera stream disconnected',
            cameraId: matchedCamera.id,
            eventId: channel.eventId
          };
        }
      }

      if (
        channel.streamKey === streamKey ||
        channel.primaryIngestRtmp.endsWith(streamKey) ||
        channel.backupIngestRtmp.endsWith(streamKey)
      ) {
        channel.status = 'OFFLINE';
        return { code: 0, message: 'Channel unpublish acknowledged', eventId: channel.eventId };
      }
    }

    return { code: 0, message: 'Unpublish acknowledged' };
  }

  static handleSrsPlay(token: string, cameraId?: string): { code: number; message: string } {
    const verified = verifyStreamToken(token, STREAM_VERIFICATION_KEY, cameraId);
    if (!verified.valid) {
      return { code: 1, message: verified.reason || 'Invalid or expired stream playback token' };
    }
    return { code: 0, message: 'Playback authorized' };
  }

  static getActiveViewersCount(eventId?: string): number {
    if (!eventId) return activeSessions.size + 1420;
    const count = Array.from(activeSessions.values()).filter(s => s.eventId === eventId).length;
    return count + 1420;
  }

  static getAllChannels(): StreamChannel[] {
    return Object.values(mockChannels);
  }
}
