'use client';

import { useState, useEffect } from 'react';
import { Gift, Coins, Sparkles, Plus } from 'lucide-react';
import { VirtualGift, GiftTransaction } from '@concert/types';

interface GiftTrayProps {
  eventId: string;
  onGiftSent?: (tx: GiftTransaction) => void;
}

export default function GiftTray({ eventId, onGiftSent }: GiftTrayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [gifts, setGifts] = useState<VirtualGift[]>([]);
  const [balance, setBalance] = useState(350);
  const [selectedGift, setSelectedGift] = useState<VirtualGift | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [activeAnimations, setActiveAnimations] = useState<GiftTransaction[]>([]);

  useEffect(() => {
    fetch('/api/v1/gifts/catalog')
      .then(res => res.json())
      .then(data => {
        if (data.catalog) setGifts(data.catalog);
      })
      .catch(() => {});
  }, []);

  const handleSend = async (gift: VirtualGift) => {
    if (balance < gift.coins) {
      alert(`Insufficient coins. Please top up your wallet.`);
      return;
    }

    setIsSending(true);
    try {
      const res = await fetch('/api/v1/gifts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          giftId: gift.id,
          count: 1
        })
      });
      const data = await res.json();
      if (res.ok) {
        setBalance(data.remainingBalance);
        // Trigger floating screen animation
        setActiveAnimations(prev => [...prev, data.transaction]);
        setTimeout(() => {
          setActiveAnimations(prev => prev.filter(a => a.id !== data.transaction.id));
        }, 4000);

        if (onGiftSent) onGiftSent(data.transaction);
      } else {
        alert(data.error || 'Failed to send gift');
      }
    } catch {
      alert('Error sending gift');
    } finally {
      setIsSending(false);
      setIsOpen(false);
    }
  };

  const handleTopUp = () => {
    setBalance(prev => prev + 500);
    alert('Wallet topped up with 500 Coins! (Demo)');
  };

  return (
    <>
      {/* Floating Gift Animations across Screen */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {activeAnimations.map((anim, idx) => (
          <div
            key={anim.id}
            style={{
              left: `${20 + (idx * 25) % 60}%`,
              bottom: '20%'
            }}
            className="absolute flex items-center gap-2 rounded-full bg-surface/95 border border-polo-red/60 px-4 py-2 shadow-2xl backdrop-blur-xl animate-bounce"
          >
            <span className="text-3xl">{anim.emoji}</span>
            <div className="flex flex-col">
              <span className="text-xs font-black text-white">{anim.senderName} sent {anim.giftName}!</span>
              <span className="text-[10px] text-polo-red font-bold">+{anim.coins} Stage Hype</span>
            </div>
          </div>
        ))}
      </div>

      {/* Gift Trigger Button */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-polo-red px-4 py-2 text-xs font-extrabold text-white shadow-lg hover:brightness-110 active:scale-95 transition-all"
        >
          <Gift className="size-4 animate-bounce" />
          <span>Send Gift</span>
          <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] flex items-center gap-1">
            <Coins className="size-3 text-amber-300" />
            {balance}
          </span>
        </button>

        {/* Gift Selection Panel */}
        {isOpen && (
          <div className="fixed inset-x-3 sm:inset-x-auto sm:absolute bottom-16 sm:bottom-12 sm:right-0 max-w-sm sm:w-80 rounded-2xl border border-line bg-surface/98 backdrop-blur-2xl p-4 shadow-2xl z-50">
            <div className="flex items-center justify-between border-b border-line pb-3 mb-3">
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-4 text-amber-400" />
                <span className="text-xs font-black text-white uppercase tracking-wider">Send Performer Gift</span>
              </div>
              <button
                onClick={handleTopUp}
                className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full"
                title="Top up coins"
              >
                <Plus className="size-3" /> Top Up
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {gifts.map((g) => (
                <button
                  key={g.id}
                  disabled={isSending}
                  onClick={() => handleSend(g)}
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-line bg-surface-raised hover:border-polo-red hover:bg-polo-red/10 active:scale-95 transition-all group"
                >
                  <span className="text-2xl group-hover:scale-125 transition-transform">{g.emoji}</span>
                  <span className="text-[11px] font-bold text-white mt-1">{g.name}</span>
                  <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-0.5 mt-0.5">
                    <Coins className="size-2.5" />
                    {g.coins}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-3 pt-2 border-t border-line text-center text-[10px] text-muted">
              Gifts trigger live animations visible to all audience members and support the artists directly.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
