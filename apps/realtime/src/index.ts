import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import cors from 'cors';
import { ChatService, GiftService, StreamService } from '@concert/business-logic';

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

    // Send back initial state
    const history = ChatService.getMessages(eventId);
    socket.emit('chat_history', history);

    const viewerCount = StreamService.getActiveViewersCount(eventId);
    io.to(`event:${eventId}`).emit('viewers_updated', { count: viewerCount });
  });

  // Client leaves room
  socket.on('leave_event', ({ eventId }) => {
    socket.leave(`event:${eventId}`);
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
  console.log(`[Realtime Service] Persistent Socket.IO live server listening on port ${PORT}`);
});
