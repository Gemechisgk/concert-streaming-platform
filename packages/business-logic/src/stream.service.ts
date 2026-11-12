import { StreamChannel, PlaybackSession, StreamQualityProfile } from '@concert/types';
import { AppError, createStreamToken, verifyStreamToken } from '@concert/shared';
import { TicketService } from './ticket.service';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_stream_secret_key_antigravity_123';

// Active in-memory playback sessions to enforce single active session policy per ticket
let activeSessions: Map<string, PlaybackSession> = new Map();

// Mock Stream Channels
let mockChannels: Record<string, StreamChannel> = {
  evt_veronica_01: {
    id: 'ch_veronica_01',
    eventId: 'evt_veronica_01',
    status: 'LIVE',
    // Live YouTube Stream Feed requested by user
    hlsMasterUrl: 'https://www.youtube.com/watch?v=mSrVwIRKASI',
    youtubeVideoUrl: 'https://www.youtube.com/watch?v=mSrVwIRKASI',
    fallbackMp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    qualities: [
      { name: '1080p', bitrateKbps: 4500, resolution: '1920x1080', playlistUrl: 'https://test-streams.mux.dev/x36xhzz/url_0/1920x1080/index.m3u8' },
      { name: '720p', bitrateKbps: 2500, resolution: '1280x720', playlistUrl: 'https://test-streams.mux.dev/x36xhzz/url_2/1280x720/index.m3u8' },
      { name: '480p', bitrateKbps: 1000, resolution: '854x480', playlistUrl: 'https://test-streams.mux.dev/x36xhzz/url_4/854x480/index.m3u8' },
      { name: '360p', bitrateKbps: 600, resolution: '640x360', playlistUrl: 'https://test-streams.mux.dev/x36xhzz/url_6/640x360/index.m3u8' },
      { name: 'Auto', bitrateKbps: 4500, resolution: 'Adaptive ABR', playlistUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' }
    ],
    primaryIngestRtmp: 'rtmp://localhost:1935/live/veronica_live_master',
    backupIngestRtmp: 'rtmp://localhost:1935/live/veronica_live_backup',
    streamKey: 'live_veronica_secret_key_prim',
    fps: 59.94,
    currentBitrateKbps: 4800,
    dropFrames: 0
  },
  evt_teddy_afro_01: {
    id: 'ch_teddy_01',
    eventId: 'evt_teddy_afro_01',
    status: 'LIVE',
    hlsMasterUrl: 'https://www.youtube.com/watch?v=mSrVwIRKASI',
    youtubeVideoUrl: 'https://www.youtube.com/watch?v=mSrVwIRKASI',
    fallbackMp4Url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    qualities: [
      { name: '1080p', bitrateKbps: 4500, resolution: '1920x1080', playlistUrl: 'https://test-streams.mux.dev/x36xhzz/url_0/1920x1080/index.m3u8' },
      { name: '720p', bitrateKbps: 2500, resolution: '1280x720', playlistUrl: 'https://test-streams.mux.dev/x36xhzz/url_2/1280x720/index.m3u8' },
      { name: 'Auto', bitrateKbps: 4500, resolution: 'Adaptive ABR', playlistUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' }
    ],
    primaryIngestRtmp: 'rtmp://localhost:1935/live/veronica_live_master',
    backupIngestRtmp: 'rtmp://localhost:1935/live/veronica_live_backup',
    streamKey: 'live_veronica_secret_key_prim',
    fps: 59.94,
    currentBitrateKbps: 4800,
    dropFrames: 0
  },
  evt_rophnan_02: {
    id: 'ch_rophnan_02',
    eventId: 'evt_rophnan_02',
    status: 'OFFLINE',
    hlsMasterUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    qualities: [],
    primaryIngestRtmp: 'rtmp://localhost:1935/live/rophnan_live_master',
    backupIngestRtmp: 'rtmp://localhost:1935/live/rophnan_live_backup',
    streamKey: 'live_rophnan_mystics_key_prim',
    fps: 60,
    currentBitrateKbps: 0,
    dropFrames: 0
  }
};

export class StreamService {
  static getChannelByEventId(eventId: string): StreamChannel | null {
    if (eventId === 'evt_teddy_afro_01' || eventId === 'teddy-afro-live-in-addis') {
      return mockChannels['evt_veronica_01'] || mockChannels['evt_teddy_afro_01'];
    }
    return mockChannels[eventId] ?? mockChannels['evt_veronica_01'] ?? null;
  }

  static authorizeStreamAccess(ticketCode: string, eventId: string, userId: string = 'viewer'): { token: string; channel: StreamChannel } {
    const verification = TicketService.verifyTicketForEvent(ticketCode, eventId);
    if (!verification.valid || !verification.ticket) {
      throw new AppError(verification.reason || 'Invalid ticket code for this concert.', 403, 'INVALID_TICKET');
    }

    const channel = this.getChannelByEventId(eventId);
    if (!channel) {
      throw new AppError('Streaming channel for this concert is not initialized.', 404, 'CHANNEL_NOT_FOUND');
    }

    // Single active stream session policy per ticket holder (Blueprint Section 10)
    // If ticket is already active in another session, terminate previous session
    const existingSession = Array.from(activeSessions.values()).find(s => s.ticketId === verification.ticket!.id);
    if (existingSession) {
      activeSessions.delete(existingSession.streamToken);
    }

    // Generate signed HMAC token with 15-min rolling expiry
    const streamToken = createStreamToken(verification.ticket.id, eventId, userId, JWT_SECRET);

    const newSession: PlaybackSession = {
      sessionId: `sess_${Date.now()}`,
      ticketId: verification.ticket.id,
      userId,
      eventId,
      streamToken,
      startedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      lastHeartbeat: new Date().toISOString()
    };

    activeSessions.set(streamToken, newSession);
    return { token: streamToken, channel };
  }

  static recordHeartbeat(streamToken: string): boolean {
    const session = activeSessions.get(streamToken);
    if (!session) {
      return false;
    }
    const tokenCheck = verifyStreamToken(streamToken, JWT_SECRET);
    if (!tokenCheck.valid) {
      activeSessions.delete(streamToken);
      return false;
    }

    session.lastHeartbeat = new Date().toISOString();
    return true;
  }

  // SRS Webhook Handlers (Section 9 & 13)
  static handleSrsPublish(streamKey: string): { code: number; message: string } {
    // Check if streamKey matches any channel's primary or backup key
    const found = Object.values(mockChannels).find(
      c => c.streamKey === streamKey || c.primaryIngestRtmp.endsWith(streamKey) || c.backupIngestRtmp.endsWith(streamKey)
    );
    if (!found) {
      return { code: 1, message: 'Unauthorized stream key' }; // SRS rejects push when code != 0
    }
    found.status = 'LIVE';
    return { code: 0, message: 'Stream authorized' };
  }

  static handleSrsPlay(token: string): { code: number; message: string } {
    const verified = verifyStreamToken(token, JWT_SECRET);
    if (!verified.valid) {
      return { code: 1, message: 'Invalid or expired stream playback token' };
    }
    return { code: 0, message: 'Playback authorized' };
  }

  static getActiveViewersCount(eventId?: string): number {
    if (!eventId) return activeSessions.size + 1420; // 1420 simulated live audience members
    const count = Array.from(activeSessions.values()).filter(s => s.eventId === eventId).length;
    return count + 1420;
  }

  static getAllChannels(): StreamChannel[] {
    return Object.values(mockChannels);
  }
}
