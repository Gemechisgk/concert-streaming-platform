'use client';

import { useState, useEffect } from 'react';
import { ChatMessage } from '@concert/types';
import { MessageSquare, Shield, Pin, Trash2, Ban, AlertTriangle } from 'lucide-react';

export default function AdminModerationPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bannedCount, setBannedCount] = useState(0);

  useEffect(() => {
    fetch('/api/v1/chat?eventId=evt_teddy_afro_01')
      .then(res => res.json())
      .then(data => {
        if (data.messages) setMessages(data.messages);
      });
  }, []);

  const handleModerate = async (action: 'PIN' | 'DELETE' | 'BAN_USER', messageId?: string, targetUserId?: string) => {
    await fetch('/api/v1/chat/moderation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, messageId, targetUserId, eventId: 'evt_teddy_afro_01' })
    });

    if (action === 'DELETE' && messageId) {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } else if (action === 'PIN' && messageId) {
      setMessages(prev =>
        prev.map(m => ({ ...m, isPinned: m.id === messageId }))
      );
    } else if (action === 'BAN_USER') {
      setBannedCount(prev => prev + 1);
      alert('User banned from live chat across all rooms.');
    }
  };

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-white">
          Real-time Chat Moderation
        </h1>
        <p className="text-xs text-muted mt-1">
          Review live audience message streams, enforce slow mode, delete offensive comments, and apply instant user bans.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <span className="text-[10px] uppercase font-bold text-muted block">Automated Profanity Filter</span>
          <span className="text-base font-black text-emerald-400 mt-1 block">Active (Regex Enforced)</span>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <span className="text-[10px] uppercase font-bold text-muted block">Slow Mode Interval</span>
          <span className="text-base font-black text-white mt-1 block">3 Seconds / Message</span>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <span className="text-[10px] uppercase font-bold text-muted block">Restricted Audience Users</span>
          <span className="text-base font-black text-polo-red mt-1 block">{bannedCount} Banned</span>
        </div>
      </div>

      {/* Messages Queue */}
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-xl">
        <h2 className="text-base font-extrabold text-white mb-4">Audience Message Stream</h2>

        <div className="divide-y divide-line/60">
          {messages.map((m) => (
            <div key={m.id} className="py-3.5 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-xs">{m.userName}</span>
                  <span className="text-[10px] text-muted font-mono">{m.userId}</span>
                  {m.isPinned && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-polo-red/20 text-polo-red border border-polo-red/40">
                      Pinned
                    </span>
                  )}
                  <span className="text-[10px] text-muted ml-auto">
                    {new Date(m.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-neutral-300 text-xs mt-1">{m.text}</p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleModerate('PIN', m.id)}
                  className="p-1.5 rounded-lg border border-line bg-surface-raised text-muted hover:text-polo-red"
                  title="Pin Announcement"
                >
                  <Pin className="size-3.5" />
                </button>
                <button
                  onClick={() => handleModerate('DELETE', m.id)}
                  className="p-1.5 rounded-lg border border-line bg-surface-raised text-muted hover:text-red-400"
                  title="Delete message"
                >
                  <Trash2 className="size-3.5" />
                </button>
                <button
                  onClick={() => handleModerate('BAN_USER', undefined, m.userId)}
                  className="p-1.5 rounded-lg border border-line bg-surface-raised text-muted hover:text-red-500"
                  title="Ban User"
                >
                  <Ban className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
