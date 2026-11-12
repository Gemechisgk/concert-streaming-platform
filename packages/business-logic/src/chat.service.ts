import { ChatMessage, SystemRole } from '@concert/types';
import { AppError } from '@concert/shared';

// Event chat histories
let mockChatMessages: Record<string, ChatMessage[]> = {
  evt_veronica_01: [
    {
      id: 'msg_v01',
      eventId: 'evt_veronica_01',
      userId: 'usr_mod',
      userName: 'Feshta Stage Director',
      userRole: 'EVENT_ADMIN',
      text: '🎵 Welcome to Veronica Adane Live at Feshta Fest! Crystal clear HD stream & studio audio enabled. Enjoy the concert! 🎉',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      isPinned: true
    },
    {
      id: 'msg_v02',
      eventId: 'evt_veronica_01',
      userId: 'usr_02',
      userName: 'Selamawit T.',
      userRole: 'VIEWER',
      text: 'Greetings from Addis Ababa! Veronica looks absolutely stunning on the main stage! 🔥🔥🔥',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString()
    },
    {
      id: 'msg_v03',
      eventId: 'evt_veronica_01',
      userId: 'usr_03',
      userName: 'Dawit M.',
      userRole: 'VIEWER',
      text: 'The sound quality is 10/10 with headphones! Cleanest live stream ever 🎧✨',
      timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString()
    },
    {
      id: 'msg_v04',
      eventId: 'evt_veronica_01',
      userId: 'usr_04',
      userName: 'Almaz K.',
      userRole: 'VIEWER',
      text: 'That vocal intro gave me absolute chills!! 🌹🌹 Singing every lyric!',
      timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString()
    },
    {
      id: 'msg_v05',
      eventId: 'evt_veronica_01',
      userId: 'usr_05',
      userName: 'Brook E.',
      userRole: 'VIEWER',
      text: 'Watching live with the whole family in Frankfurt! Feshta Fest is on fire! 🇪🇹❤️',
      timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString()
    }
  ],
  evt_teddy_afro_01: [
    {
      id: 'msg_01',
      eventId: 'evt_teddy_afro_01',
      userId: 'usr_mod',
      userName: 'Stage Director',
      userRole: 'EVENT_ADMIN',
      text: '🎵 Welcome to the live concert broadcast! Sound check crystal clear. Enjoy the show!',
      timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      isPinned: true
    },
    {
      id: 'msg_02',
      eventId: 'evt_teddy_afro_01',
      userId: 'usr_02',
      userName: 'Selamawit',
      userRole: 'VIEWER',
      text: 'Greetings from Washington DC! Sound is incredible! 🔥🇪🇹',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString()
    }
  ]
};

// Banned users set
let bannedUsers: Set<string> = new Set();

// Rate limiting map: userId -> lastMessageTimestamp
let userLastMessageTimes: Map<string, number> = new Map();

// Filtered profanity words list
const PROHIBITED_WORDS = ['hate', 'scam', 'spam', 'pirate', 'abuse'];

export class ChatService {
  static getMessages(eventId: string): ChatMessage[] {
    if (eventId === 'veronica-adane-live') return mockChatMessages['evt_veronica_01'] ?? [];
    return mockChatMessages[eventId] ?? mockChatMessages['evt_veronica_01'] ?? [];
  }

  static postMessage(params: {
    eventId: string;
    userId: string;
    userName: string;
    userRole?: SystemRole;
    text: string;
  }): ChatMessage {
    if (bannedUsers.has(params.userId)) {
      throw new AppError('You have been restricted from participating in the live chat.', 403, 'USER_BANNED');
    }

    // Rate limit check: minimum 2 seconds between messages
    const lastTime = userLastMessageTimes.get(params.userId) ?? 0;
    const now = Date.now();
    if (now - lastTime < 2000 && params.userRole !== 'SUPER_ADMIN' && params.userRole !== 'CHAT_MODERATOR') {
      throw new AppError('You are chatting too fast. Please wait a moment.', 429, 'SLOW_MODE');
    }

    // Word filter
    let cleanedText = params.text;
    for (const badWord of PROHIBITED_WORDS) {
      const regex = new RegExp(`\\b${badWord}\\b`, 'gi');
      cleanedText = cleanedText.replace(regex, '***');
    }

    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      eventId: params.eventId,
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole ?? 'VIEWER',
      text: cleanedText,
      timestamp: new Date().toISOString()
    };

    if (!mockChatMessages[params.eventId]) {
      mockChatMessages[params.eventId] = [];
    }

    mockChatMessages[params.eventId].push(newMessage);
    userLastMessageTimes.set(params.userId, now);

    // Keep buffer to last 200 messages in memory
    if (mockChatMessages[params.eventId].length > 200) {
      mockChatMessages[params.eventId].shift();
    }

    return newMessage;
  }

  static pinMessage(eventId: string, messageId: string): void {
    const list = mockChatMessages[eventId];
    if (!list) return;
    list.forEach(m => {
      m.isPinned = m.id === messageId;
    });
  }

  static deleteMessage(eventId: string, messageId: string): void {
    if (mockChatMessages[eventId]) {
      mockChatMessages[eventId] = mockChatMessages[eventId].filter(m => m.id !== messageId);
    }
  }

  static banUser(userId: string): void {
    bannedUsers.add(userId);
  }

  static unbanUser(userId: string): void {
    bannedUsers.delete(userId);
  }
}
