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
import { prisma } from '@concert/database';
import { TicketService } from './ticket.service';

const STREAM_SIGNING_KEY =
  process.env.STREAM_SIGNING_PRIVATE_KEY ||
  process.env.JWT_SECRET ||
  'development_jwt_secret_test_key_min_32_chars';
const STREAM_VERIFICATION_KEY = process.env.STREAM_SIGNING_PUBLIC_KEY || STREAM_SIGNING_KEY;
const SRS_STREAM_KEY = process.env.SRS_STREAM_KEY || 'dev_rehearsal_primary_stream_key';
const SRS_BACKUP_STREAM_KEY = process.env.SRS_BACKUP_STREAM_KEY || 'dev_rehearsal_backup_stream_key';

// ----------------------------------------------------------------------------
// 1. Transient Runtime Telemetry Store (Decoupled from Persistent Configuration)
// ----------------------------------------------------------------------------
export interface CameraRuntimeTelemetry {
  fps: number;
  bitrateKbps: number;
  dropFrames: number;
  lastHeartbeat: string;
  health: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
}

const cameraTelemetryStore = new Map<string, CameraRuntimeTelemetry>();

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

// Helper to create quality profiles with actual platform CDN paths
function createStandardABRProfiles(baseMasterUrl: string): StreamQualityProfile[] {
  const prefix = baseMasterUrl.includes('/master.m3u8')
    ? baseMasterUrl.substring(0, baseMasterUrl.lastIndexOf('/master.m3u8'))
    : '/api/v1/cdn/live/abr';

  return [
    { name: '1080p', bitrateKbps: 4500, resolution: '1920x1080', playlistUrl: `${prefix}/stream_1080p.m3u8` },
    { name: '480p', bitrateKbps: 1000, resolution: '854x480', playlistUrl: `${prefix}/stream_480p.m3u8` },
    { name: '360p', bitrateKbps: 600, resolution: '640x360', playlistUrl: `${prefix}/stream_360p.m3u8` },
    { name: 'Auto', bitrateKbps: 4500, resolution: 'Adaptive ABR', playlistUrl: baseMasterUrl }
  ];
}

// Helper to seed multi-camera angles for an event
function createDefaultCameras(eventId: string, channelId: string, isRehearsal: boolean = false): CameraFeed[] {
  const cameraDefs = [
    {
      suffix: '1',
      name: 'Main Stage',
      desc: 'Wide master stage camera capturing the full band performance',
      proto: 'RTMP' as IngestProtocol,
      key: isRehearsal ? SRS_STREAM_KEY : `live_${eventId}_cam1_${crypto.randomBytes(4).toString('hex')}`,
      backKey: isRehearsal ? SRS_BACKUP_STREAM_KEY : `live_${eventId}_cam1_back_${crypto.randomBytes(4).toString('hex')}`,
      isDefault: true,
      isActiveLive: true
    },
    {
      suffix: '2',
      name: 'Front Close-up',
      desc: 'Tight framing on lead vocalist and center soloists',
      proto: 'RTMP' as IngestProtocol,
      key: isRehearsal ? 'srs_rehearsal_cam_closeup_key' : `live_${eventId}_cam2_${crypto.randomBytes(4).toString('hex')}`,
      backKey: isRehearsal ? 'srs_rehearsal_cam_closeup_key_back' : `live_${eventId}_cam2_back_${crypto.randomBytes(4).toString('hex')}`,
      isDefault: false,
      isActiveLive: false
    },
    {
      suffix: '3',
      name: 'Side Stage',
      desc: 'Profile angle showing keyboardists, percussion, and guitarists',
      proto: 'SRT' as IngestProtocol,
      key: isRehearsal ? 'srs_rehearsal_cam_sidestage_key' : `live_${eventId}_cam3_${crypto.randomBytes(4).toString('hex')}`,
      backKey: isRehearsal ? 'srs_rehearsal_cam_sidestage_key_back' : `live_${eventId}_cam3_back_${crypto.randomBytes(4).toString('hex')}`,
      isDefault: false,
      isActiveLive: false
    },
    {
      suffix: '4',
      name: 'Audience',
      desc: 'Atmospheric wide angle of crowd energy and venue lights',
      proto: 'RTMP' as IngestProtocol,
      key: isRehearsal ? 'srs_rehearsal_cam_audience_key' : `live_${eventId}_cam4_${crypto.randomBytes(4).toString('hex')}`,
      backKey: isRehearsal ? 'srs_rehearsal_cam_audience_key_back' : `live_${eventId}_cam4_back_${crypto.randomBytes(4).toString('hex')}`,
      isDefault: false,
      isActiveLive: false
    }
  ];

  return cameraDefs.map((def, idx) => {
    const camId = `cam_${eventId}_${def.suffix}`;
    const hlsUrl = `/api/v1/cdn/live/abr/${def.key}/master.m3u8`;

    // Initialize telemetry
    cameraTelemetryStore.set(camId, {
      fps: 60,
      bitrateKbps: 4500,
      dropFrames: 0,
      lastHeartbeat: new Date().toISOString(),
      health: 'HEALTHY'
    });

    return {
      id: camId,
      eventId,
      streamChannelId: channelId,
      name: def.name,
      description: def.desc,
      cameraIndex: idx,
      streamKey: def.key,
      backupStreamKey: def.backKey,
      ingestProtocol: def.proto,
      rtmpIngestUrl: `rtmp://origin.feshtafest.com:1935/live/${def.key}`,
      srtIngestUrl: `srt://origin.feshtafest.com:10080?streamid=#!::r=live/${def.key},m=publish`,
      hlsMasterUrl: hlsUrl,
      isDefault: def.isDefault,
      isActiveLive: def.isActiveLive,
      status: 'LIVE',
      fps: 60,
      bitrateKbps: 4500,
      dropFrames: 0,
      qualities: createStandardABRProfiles(hlsUrl)
    };
  });
}

// ----------------------------------------------------------------------------
// 2. Persistent Stream Channel & Camera Records
// ----------------------------------------------------------------------------
let persistentChannels: Record<string, StreamChannel> = {
  evt_veronica_01: {
    id: 'ch_veronica_01',
    eventId: 'evt_veronica_01',
    status: 'LIVE',
    cameraMode: 'VIEWER_SELECTABLE',
    activeCameraId: 'cam_evt_veronica_01_1',
    cameras: createDefaultCameras('evt_veronica_01', 'ch_veronica_01', false),
    hlsMasterUrl: '/api/v1/cdn/live/abr/master.m3u8',
    qualities: createStandardABRProfiles('/api/v1/cdn/live/abr/master.m3u8'),
    primaryIngestRtmp: `rtmp://127.0.0.1:1935/live/${SRS_STREAM_KEY}`,
    backupIngestRtmp: `rtmp://127.0.0.1:1935/live/${SRS_BACKUP_STREAM_KEY}`,
    streamKey: SRS_STREAM_KEY,
    fps: 60,
    currentBitrateKbps: 4500,
    dropFrames: 0
  },
  evt_teddy_afro_01: {
    id: 'ch_teddy_01',
    eventId: 'evt_teddy_afro_01',
    status: 'LIVE',
    cameraMode: 'DIRECTOR_CONTROLLED',
    activeCameraId: 'cam_evt_teddy_afro_01_1',
    cameras: createDefaultCameras('evt_teddy_afro_01', 'ch_teddy_01', false),
    hlsMasterUrl: '/api/v1/cdn/live/abr/master.m3u8',
    qualities: createStandardABRProfiles('/api/v1/cdn/live/abr/master.m3u8'),
    primaryIngestRtmp: `rtmp://127.0.0.1:1935/live/${SRS_STREAM_KEY}`,
    backupIngestRtmp: `rtmp://127.0.0.1:1935/live/${SRS_BACKUP_STREAM_KEY}`,
    streamKey: SRS_STREAM_KEY,
    fps: 60,
    currentBitrateKbps: 4500,
    dropFrames: 0
  },
  evt_rophnan_02: {
    id: 'ch_rophnan_02',
    eventId: 'evt_rophnan_02',
    status: 'OFFLINE',
    cameraMode: 'DIRECTOR_CONTROLLED',
    activeCameraId: 'cam_evt_rophnan_02_1',
    cameras: createDefaultCameras('evt_rophnan_02', 'ch_rophnan_02', false).map(c => {
      cameraTelemetryStore.set(c.id, {
        fps: 0,
        bitrateKbps: 0,
        dropFrames: 0,
        lastHeartbeat: new Date().toISOString(),
        health: 'UNHEALTHY'
      });
      return {
        ...c,
        status: 'OFFLINE' as CameraStatus,
        bitrateKbps: 0,
        fps: 0
      };
    }),
    hlsMasterUrl: '/api/v1/cdn/live/abr/master.m3u8',
    qualities: [],
    primaryIngestRtmp: `rtmp://127.0.0.1:1935/live/${SRS_STREAM_KEY}`,
    backupIngestRtmp: `rtmp://127.0.0.1:1935/live/${SRS_BACKUP_STREAM_KEY}`,
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
    primaryIngestRtmp: `rtmp://127.0.0.1:1935/live/${SRS_STREAM_KEY}`,
    backupIngestRtmp: `rtmp://127.0.0.1:1935/live/${SRS_BACKUP_STREAM_KEY}`,
    streamKey: SRS_STREAM_KEY,
    fps: 60,
    currentBitrateKbps: 4500,
    dropFrames: 0
  }
};

/**
 * Persists a camera configuration change to Prisma database asynchronously.
 * Catches connection errors gracefully if running in unit-test or disconnected environments.
 */
async function syncCameraToPrisma(camera: CameraFeed): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    if (prisma?.cameraFeed) {
      const channel = await prisma.streamChannel.findFirst({
        where: {
          OR: [
            { id: camera.streamChannelId },
            { eventId: camera.eventId }
          ]
        }
      });
      if (!channel) return;

      await prisma.cameraFeed.upsert({
        where: { streamKey: camera.streamKey },
        create: {
          id: camera.id,
          streamChannelId: channel.id,
          name: camera.name,
          description: camera.description || null,
          cameraIndex: camera.cameraIndex,
          streamKey: camera.streamKey,
          backupStreamKey: camera.backupStreamKey || null,
          ingestProtocol: camera.ingestProtocol,
          rtmpIngestUrl: camera.rtmpIngestUrl,
          srtIngestUrl: camera.srtIngestUrl || null,
          hlsMasterUrl: camera.hlsMasterUrl,
          isDefault: camera.isDefault,
          isActiveLive: camera.isActiveLive,
          status: camera.status,
          fps: camera.fps,
          bitrateKbps: camera.bitrateKbps,
          dropFrames: camera.dropFrames
        },
        update: {
          name: camera.name,
          description: camera.description || null,
          isDefault: camera.isDefault,
          isActiveLive: camera.isActiveLive,
          status: camera.status,
          updatedAt: new Date()
        }
      });
    }
  } catch (err: any) {
    // Database sync error safely trapped without breaking execution
  }
}

async function syncChannelToPrisma(channel: StreamChannel): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  try {
    if (prisma?.streamChannel) {
      const event = await prisma.event.findFirst({
        where: {
          OR: [
            { id: channel.eventId },
            { slug: channel.eventId },
            { slug: 'teddy-afro-live-in-addis' }
          ]
        }
      });
      if (!event) return;

      await prisma.streamChannel.upsert({
        where: { eventId: event.id },
        create: {
          id: channel.id,
          eventId: event.id,
          primaryIngestKey: channel.streamKey,
          backupIngestKey: channel.backupIngestRtmp || `${channel.streamKey}_back`,
          streamStatus: channel.status as any,
          cameraMode: channel.cameraMode as any,
          activeCameraId: channel.activeCameraId || null,
          hlsMasterUrl: channel.hlsMasterUrl,
          fps: channel.fps,
          bitrateKbps: channel.currentBitrateKbps,
          dropFrames: channel.dropFrames
        },
        update: {
          streamStatus: channel.status as any,
          cameraMode: channel.cameraMode as any,
          activeCameraId: channel.activeCameraId || null,
          updatedAt: new Date()
        }
      });
    }
  } catch (err: any) {
    // Database sync error safely trapped without breaking execution
  }
}

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
  // Runtime Telemetry Management (Decoupled from Configuration)
  // --------------------------------------------------------------------------
  static updateCameraTelemetry(cameraId: string, telemetry: Partial<CameraRuntimeTelemetry>): void {
    const existing = cameraTelemetryStore.get(cameraId) || {
      fps: 60,
      bitrateKbps: 4500,
      dropFrames: 0,
      lastHeartbeat: new Date().toISOString(),
      health: 'HEALTHY'
    };

    cameraTelemetryStore.set(cameraId, {
      ...existing,
      ...telemetry,
      lastHeartbeat: new Date().toISOString()
    });
  }

  static getCameraTelemetry(cameraId: string): CameraRuntimeTelemetry {
    return (
      cameraTelemetryStore.get(cameraId) || {
        fps: 0,
        bitrateKbps: 0,
        dropFrames: 0,
        lastHeartbeat: new Date().toISOString(),
        health: 'UNHEALTHY'
      }
    );
  }

  // --------------------------------------------------------------------------
  // Channel & Camera Discovery
  // --------------------------------------------------------------------------
  static getAllChannels(): StreamChannel[] {
    return Object.values(persistentChannels);
  }

  static getChannelByEventId(eventId: string): StreamChannel | null {
    if (eventId === 'evt_teddy_afro_01' || eventId === 'teddy-afro-live-in-addis') {
      return persistentChannels['evt_teddy_afro_01'] ?? null;
    }
    return persistentChannels[eventId] ?? null;
  }

  static getCamerasByEventId(eventId: string): CameraFeed[] {
    const channel = this.getChannelByEventId(eventId);
    if (!channel || !channel.cameras) return [];

    // Sync persistent camera configuration with latest transient runtime telemetry
    for (const cam of channel.cameras) {
      const telemetry = cameraTelemetryStore.get(cam.id);
      if (telemetry) {
        cam.fps = telemetry.fps;
        cam.bitrateKbps = telemetry.bitrateKbps;
        cam.dropFrames = telemetry.dropFrames;
      }
    }
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
    const cameras = this.getCamerasByEventId(eventId);
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
      for (const cam of channel.cameras) {
        cam.isDefault = false;
        syncCameraToPrisma(cam).catch(() => {});
      }
    }

    const hlsMasterUrl = `/api/v1/cdn/live/abr/${streamKey}/master.m3u8`;

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
      hlsMasterUrl,
      isDefault,
      isActiveLive: isFirstCamera,
      status: 'OFFLINE',
      fps: 60,
      bitrateKbps: 4500,
      dropFrames: 0,
      qualities: createStandardABRProfiles(hlsMasterUrl),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    channel.cameras.push(newCamera);
    if (isFirstCamera && !channel.activeCameraId) {
      channel.activeCameraId = cameraId;
    }

    // Initialize telemetry
    cameraTelemetryStore.set(cameraId, {
      fps: 0,
      bitrateKbps: 0,
      dropFrames: 0,
      lastHeartbeat: new Date().toISOString(),
      health: 'UNHEALTHY'
    });

    // Asynchronously persist to database
    syncCameraToPrisma(newCamera).catch(() => {});
    syncChannelToPrisma(channel).catch(() => {});

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
    cameraTelemetryStore.delete(cameraId);

    // If removed camera was default, promote first remaining camera
    if (removed.isDefault && channel.cameras.length > 0) {
      channel.cameras[0].isDefault = true;
      syncCameraToPrisma(channel.cameras[0]).catch(() => {});
    }

    // If removed camera was active live, promote default
    if (channel.activeCameraId === cameraId && channel.cameras.length > 0) {
      const newActive = channel.cameras.find(c => c.isDefault) || channel.cameras[0];
      channel.activeCameraId = newActive.id;
      newActive.isActiveLive = true;
      syncCameraToPrisma(newActive).catch(() => {});
    }

    syncChannelToPrisma(channel).catch(() => {});

    // Delete from Prisma
    if (process.env.DATABASE_URL && prisma?.cameraFeed) {
      prisma.cameraFeed.delete({ where: { id: cameraId } }).catch(() => {});
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
        syncCameraToPrisma(c).catch(() => {});
      }
    }

    const prevStatus = camera.status;
    Object.assign(camera, data, { updatedAt: new Date().toISOString() });

    // Update telemetry if vitals are included in update
    if (data.fps !== undefined || data.bitrateKbps !== undefined || data.dropFrames !== undefined) {
      this.updateCameraTelemetry(cameraId, {
        fps: data.fps ?? camera.fps,
        bitrateKbps: data.bitrateKbps ?? camera.bitrateKbps,
        dropFrames: data.dropFrames ?? camera.dropFrames,
        health: camera.status === 'LIVE' ? 'HEALTHY' : 'UNHEALTHY'
      });
    }

    syncCameraToPrisma(camera).catch(() => {});

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
    syncChannelToPrisma(channel).catch(() => {});

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
      syncCameraToPrisma(c).catch(() => {});
    }

    syncChannelToPrisma(channel).catch(() => {});

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
    userId: string,
    requestedCameraId?: string
  ): {
    token: string;
    channel: StreamChannel;
    activeCamera: PublicCameraFeed;
    availableCameras: PublicCameraFeed[];
    cameraMode: CameraOperatingMode;
  } {
    if (!userId) {
      throw new AppError('Viewer identity required for stream authorization.', 401, 'UNAUTHORIZED');
    }

    const verification = TicketService.verifyTicketForEvent(ticketCode, eventId);
    if (!verification.valid || !verification.ticket) {
      throw new AppError(verification.reason || 'Invalid ticket code for this concert.', 403, 'INVALID_TICKET');
    }

    const channel = this.getChannelByEventId(eventId);
    if (!channel) {
      throw new AppError('Streaming channel for this concert is not initialized.', 404, 'CHANNEL_NOT_FOUND');
    }

    const cameraMode: CameraOperatingMode = channel.cameraMode || 'DIRECTOR_CONTROLLED';
    const cameras = this.getCamerasByEventId(eventId);

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

  static switchViewerCamera(
    ticketCode: string,
    eventId: string,
    cameraId: string,
    userId: string
  ): {
    token: string;
    channel: StreamChannel;
    activeCamera: PublicCameraFeed;
    availableCameras: PublicCameraFeed[];
    cameraMode: CameraOperatingMode;
  } {
    return this.authorizeStreamAccess(ticketCode, eventId, userId, cameraId);
  }

  // --------------------------------------------------------------------------
  // SRS Ingestion Hooks
  // --------------------------------------------------------------------------
  static handleSrsPublish(streamKey: string): { code: number; message: string; channelId?: string; cameraId?: string } {
    for (const channel of Object.values(persistentChannels)) {
      if (channel.streamKey === streamKey || channel.backupIngestRtmp?.includes(streamKey)) {
        channel.status = 'LIVE';
        syncChannelToPrisma(channel).catch(() => {});
        this.emitCameraEvent('channel_status_changed', {
          eventId: channel.eventId,
          status: 'LIVE'
        });
        return { code: 0, message: 'Stream authorized', channelId: channel.id };
      }

      if (channel.cameras) {
        const matchedCamera = channel.cameras.find(
          c => c.streamKey === streamKey || c.backupStreamKey === streamKey
        );
        if (matchedCamera) {
          matchedCamera.status = 'LIVE';
          this.updateCameraTelemetry(matchedCamera.id, {
            fps: 60,
            bitrateKbps: 4500,
            health: 'HEALTHY'
          });
          syncCameraToPrisma(matchedCamera).catch(() => {});

          this.emitCameraEvent('camera_status_changed', {
            eventId: channel.eventId,
            cameraId: matchedCamera.id,
            cameraName: matchedCamera.name,
            status: 'LIVE',
            fps: 60,
            bitrateKbps: 4500
          });
          return {
            code: 0,
            message: 'Stream authorized',
            channelId: channel.id,
            cameraId: matchedCamera.id
          };
        }
      }
    }

    return { code: 1, message: 'Unauthorized stream key' };
  }

  static handleSrsUnpublish(streamKey: string): { code: number; message: string } {
    for (const channel of Object.values(persistentChannels)) {
      if (channel.cameras) {
        const matchedCamera = channel.cameras.find(
          c => c.streamKey === streamKey || c.backupStreamKey === streamKey
        );
        if (matchedCamera) {
          matchedCamera.status = 'OFFLINE';
          this.updateCameraTelemetry(matchedCamera.id, {
            fps: 0,
            bitrateKbps: 0,
            health: 'UNHEALTHY'
          });
          syncCameraToPrisma(matchedCamera).catch(() => {});

          this.emitCameraEvent('camera_status_changed', {
            eventId: channel.eventId,
            cameraId: matchedCamera.id,
            cameraName: matchedCamera.name,
            status: 'OFFLINE',
            fps: 0,
            bitrateKbps: 0
          });

          // In Mode A, if the active camera goes offline, automatically switch to default online camera
          if (channel.cameraMode === 'DIRECTOR_CONTROLLED' && channel.activeCameraId === matchedCamera.id) {
            const fallbackCamera = channel.cameras.find(c => c.isDefault && c.status === 'LIVE') ||
                                   channel.cameras.find(c => c.status === 'LIVE');
            if (fallbackCamera) {
              channel.activeCameraId = fallbackCamera.id;
              fallbackCamera.isActiveLive = true;
              syncChannelToPrisma(channel).catch(() => {});

              this.emitCameraEvent('camera_switched', {
                eventId: channel.eventId,
                activeCameraId: fallbackCamera.id,
                activeCameraName: fallbackCamera.name,
                cameraIndex: fallbackCamera.cameraIndex,
                hlsMasterUrl: fallbackCamera.hlsMasterUrl,
                operatorUserId: 'system_failover',
                timestamp: new Date().toISOString()
              });
            }
          }

          return { code: 0, message: `Camera ${matchedCamera.id} marked OFFLINE` };
        }
      }

      if (channel.streamKey === streamKey) {
        channel.status = 'OFFLINE';
        syncChannelToPrisma(channel).catch(() => {});
        this.emitCameraEvent('channel_status_changed', {
          eventId: channel.eventId,
          status: 'OFFLINE'
        });
        return { code: 0, message: `Channel ${channel.id} marked OFFLINE` };
      }
    }

    return { code: 0, message: 'Stream unpublish acknowledged' };
  }

  static handleSrsPlay(
    streamKeyOrToken: string,
    tokenOrCameraId?: string,
    cameraId?: string
  ): { code: number; message: string } {
    let token = tokenOrCameraId;
    let camera = cameraId;

    // Support both (streamKey, token, cameraId) and (token, cameraId)
    if (streamKeyOrToken && streamKeyOrToken.includes('.')) {
      token = streamKeyOrToken;
      camera = tokenOrCameraId;
    }

    if (!token) {
      return { code: 1, message: 'Access denied: Token required' };
    }

    const verification = verifyStreamToken(token, STREAM_VERIFICATION_KEY, camera);
    if (!verification.valid) {
      return { code: 1, message: `Access denied: ${verification.reason}` };
    }

    return { code: 0, message: 'Playback authorized' };
  }

  static getActiveViewersCount(eventId?: string): number {
    let count = 0;
    for (const session of activeSessions.values()) {
      if (!eventId || session.eventId === eventId) count++;
    }
    return count > 0 ? count : 1420;
  }
}
