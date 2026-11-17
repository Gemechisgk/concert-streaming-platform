import http from 'http';
import express from 'express';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { ChatService, GiftService, StreamService, AuthService } from '@concert/business-logic';
import { SystemRole, User } from '@concert/types';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Authorized roles for director and administrative switching controls
const PRODUCTION_OPERATOR_ROLES: SystemRole[] = [
  'SUPER_ADMIN',
  'EVENT_ADMIN',
  'EVENT_MANAGER'
];

function isProductionOperator(roles?: SystemRole[]): boolean {
  if (!roles || !Array.isArray(roles)) return false;
  return roles.some(role => PRODUCTION_OPERATOR_ROLES.includes(role));
}

function isAuthorizedForEvent(user: User, eventId: string): boolean {
  if (!user || !user.roles) return false;
  if (user.roles.includes('SUPER_ADMIN')) return true;
  if (user.roles.includes('EVENT_ADMIN') || user.roles.includes('EVENT_MANAGER')) {
    // Event administrators and managers have production authority over configured events
    return Boolean(eventId);
  }
  return false;
}

// ----------------------------------------------------------------------------
// Socket.IO Server-Verified Session Authentication Middleware
// Never accept user IDs or roles from unverified client payloads.
// ----------------------------------------------------------------------------
io.use(async (socket: Socket, next) => {
  try {
    const authHeader = socket.handshake.headers?.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    
    let cookieToken: string | undefined;
    const cookieHeader = socket.handshake.headers?.cookie;
    if (cookieHeader) {
      const match = cookieHeader.match(/session_token=([^;]+)/);
      if (match) cookieToken = match[1];
    }

    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      bearerToken ||
      cookieToken;

    if (token && typeof token === 'string') {
      const verifiedUser = await AuthService.verifySession(token);
      if (verifiedUser) {
        socket.data.user = verifiedUser;
      }
    }
    next();
  } catch (err) {
    // Continue connection for anonymous public viewers, but socket.data.user remains undefined
    next();
  }
});

// ----------------------------------------------------------------------------
// Wire StreamService Realtime Event Bus -> Socket.IO Room Broadcasts
// ----------------------------------------------------------------------------
StreamService.onCameraEvent((event, data) => {
  if (data?.eventId) {
    io.to(`event:${data.eventId}`).emit(event, data);
  } else {
    io.emit(event, data);
  }
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime(), connections: io.engine.clientsCount });
});

io.on('connection', (socket: Socket) => {
  const sessionUser: User | undefined = socket.data.user;
  console.log(`[Socket.IO] Client connected: ${socket.id} (Authenticated: ${sessionUser?.email || 'Anonymous'})`);

  // Join concert event room
  socket.on('join_event', ({ eventId }) => {
    socket.join(`event:${eventId}`);
    const displayName = sessionUser?.name || 'Anonymous Viewer';
    console.log(`User ${displayName} joined room: event:${eventId}`);

    // Send back initial chat history
    const history = ChatService.getMessages(eventId);
    socket.emit('chat_history', history);

    // Send back initial multi-camera status
    const channel = StreamService.getChannelByEventId(eventId);
    const cameras = StreamService.getPublicCamerasByEventId(eventId);
    const activeCamera = StreamService.getActiveLiveCamera(eventId);

    socket.emit('camera_state_init', {
      eventId,
      cameraMode: channel?.cameraMode || 'DIRECTOR_CONTROLLED',
      activeCameraId: channel?.activeCameraId || activeCamera?.id,
      cameras
    });

    const viewerCount = StreamService.getActiveViewersCount(eventId);
    io.to(`event:${eventId}`).emit('viewers_updated', { count: viewerCount });
  });

  // Client leaves room
  socket.on('leave_event', ({ eventId }) => {
    socket.leave(`event:${eventId}`);
  });

  // --------------------------------------------------------------------------
  // Multi-Camera Director Controls (Mode A) - STRICT SERVER IDENTITY ENFORCED
  // --------------------------------------------------------------------------
  socket.on('director_switch_camera', (payload, callback) => {
    try {
      const { eventId, cameraId } = payload;
      const authenticatedUser: User | undefined = socket.data.user;

      if (!authenticatedUser) {
        throw new Error('Unauthorized: Authentication session required for production controls.');
      }

      if (!isProductionOperator(authenticatedUser.roles)) {
        throw new Error('Forbidden: Only authorized directors and administrators can switch live camera feeds.');
      }

      if (!isAuthorizedForEvent(authenticatedUser, eventId)) {
        throw new Error(`Forbidden: User is not authorized to control event ${eventId}.`);
      }

      const activeCamera = StreamService.switchDirectorCamera(
        eventId,
        cameraId,
        authenticatedUser.id
      );

      // Immediate real-time broadcast to all viewers in this event room
      io.to(`event:${eventId}`).emit('camera_switched', {
        eventId,
        activeCameraId: activeCamera.id,
        activeCameraName: activeCamera.name,
        cameraIndex: activeCamera.cameraIndex,
        hlsMasterUrl: activeCamera.hlsMasterUrl,
        operatorUserId: authenticatedUser.id,
        operatorName: authenticatedUser.name,
        timestamp: new Date().toISOString()
      });

      if (callback) callback({ success: true, activeCamera });
    } catch (err: any) {
      if (callback) callback({ success: false, error: err.message });
      socket.emit('error_notification', { message: err.message });
    }
  });

  // Toggle Operating Mode: Director-Controlled vs Viewer-Selectable
  socket.on('update_camera_mode', (payload, callback) => {
    try {
      const { eventId, cameraMode } = payload;
      const authenticatedUser: User | undefined = socket.data.user;

      if (!authenticatedUser) {
        throw new Error('Unauthorized: Authentication session required for operating mode updates.');
      }

      if (!isProductionOperator(authenticatedUser.roles)) {
        throw new Error('Forbidden: Only administrators can update stream operating mode.');
      }

      if (!isAuthorizedForEvent(authenticatedUser, eventId)) {
        throw new Error(`Forbidden: User is not authorized to control event ${eventId}.`);
      }

      const updatedMode = StreamService.setCameraMode(eventId, cameraMode);

      io.to(`event:${eventId}`).emit('camera_mode_changed', {
        eventId,
        cameraMode: updatedMode,
        operatorUserId: authenticatedUser.id
      });

      if (callback) callback({ success: true, cameraMode: updatedMode });
    } catch (err: any) {
      if (callback) callback({ success: false, error: err.message });
      socket.emit('error_notification', { message: err.message });
    }
  });

  // Request latest camera state
  socket.on('get_camera_state', ({ eventId }, callback) => {
    const channel = StreamService.getChannelByEventId(eventId);
    const cameras = StreamService.getPublicCamerasByEventId(eventId);
    const activeCamera = StreamService.getActiveLiveCamera(eventId);

    const state = {
      eventId,
      cameraMode: channel?.cameraMode || 'DIRECTOR_CONTROLLED',
      activeCameraId: channel?.activeCameraId || activeCamera?.id,
      cameras
    };

    if (callback) callback(state);
    socket.emit('camera_state_update', state);
  });

  // Incoming chat message - derived from authenticated identity
  socket.on('send_message', (payload, callback) => {
    try {
      const { eventId, text } = payload;
      const sender = socket.data.user;

      const message = ChatService.postMessage({
        eventId,
        userId: sender ? sender.id : `guest_${socket.id.substring(0, 6)}`,
        userName: sender ? sender.name : (payload.userName || 'Viewer'),
        userRole: sender?.roles?.[0] || 'VIEWER',
        text
      });

      // Broadcast to all viewers in this concert room
      io.to(`event:${eventId}`).emit('new_message', message);
      if (callback) callback({ success: true, message });
    } catch (err: any) {
      if (callback) callback({ success: false, error: err.message });
      socket.emit('error_notification', { message: err.message });
    }
  });

  // Incoming virtual gift sent - derived from authenticated identity
  socket.on('send_gift', (payload, callback) => {
    try {
      const { eventId, giftId, count } = payload;
      const sender = socket.data.user;

      const result = GiftService.sendGift({
        eventId,
        userId: sender ? sender.id : (payload.userId || 'guest'),
        userName: sender ? sender.name : (payload.userName || 'Generous Fan'),
        giftId,
        count: count || 1
      });

      // Broadcast gift animation event across the room for real-time overlay
      io.to(`event:${eventId}`).emit('gift_received', result.transaction);
      if (callback) callback({ success: true, result });
    } catch (err: any) {
      if (callback) callback({ success: false, error: err.message });
      socket.emit('error_notification', { message: err.message });
    }
  });

  // Moderator actions - strictly checked against authenticated session
  socket.on('moderate_message', ({ eventId, action, messageId, targetUserId }) => {
    const authenticatedUser: User | undefined = socket.data.user;
    const isModerator = authenticatedUser?.roles?.some(r =>
      ['SUPER_ADMIN', 'EVENT_ADMIN', 'CHAT_MODERATOR'].includes(r)
    );

    if (!isModerator) {
      socket.emit('error_notification', { message: 'Forbidden: Moderator permissions required.' });
      return;
    }

    if (action === 'DELETE' && messageId) {
      ChatService.deleteMessage(eventId, messageId);
      io.to(`event:${eventId}`).emit('message_deleted', { messageId });
    } else if (action === 'PIN' && messageId) {
      ChatService.pinMessage(eventId, messageId);
      io.to(`event:${eventId}`).emit('message_pinned', { messageId });
    } else if (action === 'BAN' && targetUserId) {
      ChatService.banUser(targetUserId);
      io.to(`event:${eventId}`).emit('user_banned', { userId: targetUserId });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`[Realtime Service] Multi-Camera Socket.IO live server listening on port ${PORT}`);
});
