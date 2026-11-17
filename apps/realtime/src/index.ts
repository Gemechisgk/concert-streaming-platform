import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import cors from 'cors';
import { ChatService, GiftService, StreamService } from '@concert/business-logic';
import { SystemRole } from '@concert/types';

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

function isProductionOperator(role?: SystemRole): boolean {
  if (!role) return false;
  return PRODUCTION_OPERATOR_ROLES.includes(role);
}

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

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Join concert event room
  socket.on('join_event', ({ eventId, user }) => {
    socket.join(`event:${eventId}`);
    console.log(`User ${user?.name || 'Anonymous'} joined room: event:${eventId}`);

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
  // Multi-Camera Director Controls (Mode A)
  // --------------------------------------------------------------------------
  socket.on('director_switch_camera', (payload, callback) => {
    try {
      const { eventId, cameraId, user } = payload;

      // Security check: restrict director switching to authorized production staff
      if (user?.role && !isProductionOperator(user.role)) {
        throw new Error('Forbidden: Only authorized directors and administrators can switch live camera feeds.');
      }

      const activeCamera = StreamService.switchDirectorCamera(eventId, cameraId, user?.id || 'director');

      // Immediate real-time broadcast to all viewers in this event room
      io.to(`event:${eventId}`).emit('camera_switched', {
        eventId,
        activeCameraId: activeCamera.id,
        activeCameraName: activeCamera.name,
        cameraIndex: activeCamera.cameraIndex,
        hlsMasterUrl: activeCamera.hlsMasterUrl,
        operatorUserId: user?.id || 'director',
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
      const { eventId, cameraMode, user } = payload;

      if (user?.role && !isProductionOperator(user.role)) {
        throw new Error('Forbidden: Only administrators can update stream operating mode.');
      }

      const updatedMode = StreamService.setCameraMode(eventId, cameraMode);

      io.to(`event:${eventId}`).emit('camera_mode_changed', {
        eventId,
        cameraMode: updatedMode
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

  // Incoming chat message
  socket.on('send_message', (payload, callback) => {
    try {
      const { eventId, userId, userName, userRole, text } = payload;
      const message = ChatService.postMessage({
        eventId,
        userId: userId || socket.id,
        userName: userName || 'Viewer',
        userRole,
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

  // Incoming virtual gift sent
  socket.on('send_gift', (payload, callback) => {
    try {
      const { eventId, userId, userName, giftId, count } = payload;
      const result = GiftService.sendGift({
        eventId,
        userId: userId || 'guest',
        userName: userName || 'Generous Fan',
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

  // Moderator actions
  socket.on('moderate_message', ({ eventId, action, messageId, targetUserId }) => {
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
