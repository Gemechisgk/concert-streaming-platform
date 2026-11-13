'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Pin, Shield, Trash2, Smile, AlertCircle, Ban, Sparkles } from 'lucide-react';
import { ChatMessage, SystemRole } from '@concert/types';

interface LiveChatProps {
  eventId: string;
  currentUser?: {
    id: string;
    name: string;
    role: SystemRole;
  };
}

const QUICK_REACTIONS = ['👏', '🔥', '❤️', '🌹', '👑', '🇪🇹', '🎉'];

export default function LiveChat({ eventId, currentUser }: LiveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [pinnedMessage, setPinnedMessage] = useState<ChatMessage | null>(null);
  const [slowModeCountdown, setSlowModeCountdown] = useState(0);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Fetch initial chat history
  useEffect(() => {
    fetch(`/api/v1/chat?eventId=${eventId}`)
      .then(res => res.json())
      .then(data => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          const pinned = data.messages.find((m: ChatMessage) => m.isPinned);
          if (pinned) setPinnedMessage(pinned);
        }
      })
      .catch(() => {});
  }, [eventId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle slow mode countdown
  useEffect(() => {
    if (slowModeCountdown <= 0) return;
    const timer = setInterval(() => {
      setSlowModeCountdown(prev => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [slowModeCountdown]);

  const sendMessageText = async (textToSend: string) => {
    if (!textToSend.trim() || slowModeCountdown > 0) return;

    setErrorNotice(null);
    try {
      const res = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          userId: currentUser?.id || 'viewer_guest',
          userName: currentUser?.name || 'Abebe Bikila',
          userRole: currentUser?.role || 'VIEWER',
          text: textToSend.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorNotice(data.error || 'Failed to send message');
        return;
      }

      setMessages(prev => [...prev.slice(-99), data.message]);
      setInputMessage('');
      setSlowModeCountdown(2); // 2-second rate limit
    } catch {
      setErrorNotice('Connection error sending chat message');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessageText(inputMessage);
  };

  const handleModerate = async (action: 'PIN' | 'DELETE' | 'BAN_USER', messageId?: string, targetUserId?: string) => {
    try {
      await fetch('/api/v1/chat/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, messageId, targetUserId, eventId })
      });

      if (action === 'DELETE' && messageId) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      } else if (action === 'PIN' && messageId) {
        const found = messages.find(m => m.id === messageId);
        if (found) setPinnedMessage(found);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isModerator =
    currentUser?.role === 'SUPER_ADMIN' ||
    currentUser?.role === 'EVENT_ADMIN' ||
    currentUser?.role === 'CHAT_MODERATOR';

  return (
    <div className="flex flex-col h-full rounded-2xl border border-line bg-surface overflow-hidden shadow-2xl">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5 bg-surface-raised/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="text-xs font-black uppercase tracking-wider text-white">Live Audience Chat</h3>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted">
          <span className="px-2 py-0.5 rounded-full bg-surface border border-line font-mono font-bold text-emerald-400">
            Real-Time
          </span>
        </div>
      </div>

      {/* Pinned Message */}
      {pinnedMessage && (
        <div className="border-b border-line/60 bg-polo-red/10 px-4 py-2 flex items-start gap-2.5 text-xs">
          <Pin className="size-3.5 text-polo-red shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-bold text-polo-red mr-1.5">{pinnedMessage.userName}:</span>
            <span className="text-neutral-200">{pinnedMessage.text}</span>
          </div>
          {isModerator && (
            <button
              onClick={() => setPinnedMessage(null)}
              className="text-muted hover:text-white text-[10px] uppercase font-bold shrink-0 ml-1"
            >
              Unpin
            </button>
          )}
        </div>
      )}

      {/* Error alert */}
      {errorNotice && (
        <div className="bg-red-950/80 border-b border-red-800 px-4 py-1.5 text-[11px] text-red-300 flex items-center gap-2">
          <AlertCircle className="size-3 text-red-400 shrink-0" />
          <span className="truncate">{errorNotice}</span>
        </div>
      )}

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
        {messages.map((msg) => (
          <div key={msg.id} className="group flex items-start gap-2 text-xs leading-relaxed">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-neutral-200 hover:text-white">
                  {msg.userName}
                </span>

                {/* Role Badges */}
                {msg.userRole === 'SUPER_ADMIN' || msg.userRole === 'EVENT_ADMIN' ? (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-polo-red text-white flex items-center gap-0.5">
                    <Shield className="size-2.5" /> STAFF
                  </span>
                ) : msg.userRole === 'CHAT_MODERATOR' ? (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-purple-600 text-white">
                    MOD
                  </span>
                ) : null}

                <span className="text-[10px] text-muted ml-auto hidden group-hover:inline-block">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <p className="text-neutral-300 break-words mt-0.5 font-normal">
                {msg.text}
              </p>
            </div>

            {/* Mod actions */}
            {isModerator && (
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
                <button
                  onClick={() => handleModerate('PIN', msg.id)}
                  className="p-1 rounded hover:bg-surface-raised text-muted hover:text-polo-red"
                  title="Pin message"
                >
                  <Pin className="size-3" />
                </button>
                <button
                  onClick={() => handleModerate('DELETE', msg.id)}
                  className="p-1 rounded hover:bg-surface-raised text-muted hover:text-red-400"
                  title="Delete message"
                >
                  <Trash2 className="size-3" />
                </button>
                <button
                  onClick={() => handleModerate('BAN_USER', undefined, msg.userId)}
                  className="p-1 rounded hover:bg-surface-raised text-muted hover:text-red-500"
                  title="Ban user"
                >
                  <Ban className="size-3" />
                </button>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Emoji Reaction Tap Bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-surface-raised border-t border-line/60 overflow-x-auto no-scrollbar">
        <span className="text-[10px] uppercase font-bold text-muted mr-1 shrink-0">Cheer:</span>
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => sendMessageText(emoji)}
            className="size-7 rounded-full bg-surface border border-line hover:border-polo-red hover:scale-110 active:scale-95 flex items-center justify-center text-sm transition-all shrink-0"
            title={`Cheer with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="p-2.5 border-t border-line bg-surface">
        <div className="flex items-center gap-2 rounded-xl bg-surface-raised border border-line focus-within:border-polo-red/60 px-3 py-1.5 transition-colors">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={
              slowModeCountdown > 0
                ? `Slow mode (${slowModeCountdown}s)...`
                : 'Send a reaction to the concert...'
            }
            maxLength={300}
            disabled={slowModeCountdown > 0}
            className="flex-1 bg-transparent text-xs text-white placeholder-muted focus:outline-none"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || slowModeCountdown > 0}
            className="p-1.5 rounded-lg bg-polo-red text-white disabled:opacity-40 hover:bg-polo-red-dark transition-all shrink-0"
          >
            <Send className="size-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
