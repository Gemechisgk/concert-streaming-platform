import { VirtualGift, GiftTransaction } from '@concert/types';
import { AppError } from '@concert/shared';

const GIFT_CATALOG: VirtualGift[] = [
  { id: 'g_rose', name: 'Rose', emoji: '🌹', coins: 10, priceCents: 1000, animation: 'heart' },
  { id: 'g_applause', name: 'Applause', emoji: '👏', coins: 25, priceCents: 2500, animation: 'sparkle' },
  { id: 'g_mic', name: 'Golden Mic', emoji: '🎤', coins: 50, priceCents: 5000, animation: 'sparkle' },
  { id: 'g_guitar', name: 'Electric Guitar', emoji: '🎸', coins: 100, priceCents: 10000, animation: 'guitar' },
  { id: 'g_fireworks', name: 'Fireworks', emoji: '🎆', coins: 250, priceCents: 25000, animation: 'fireworks' },
  { id: 'g_crown', name: 'Crown', emoji: '👑', coins: 500, priceCents: 50000, animation: 'crown' }
];

// Wallet balance map: userId -> coins
let userWallets: Map<string, number> = new Map([
  ['user_viewer_01', 500],
  ['guest', 250]
]);

// Gift transactions history
let giftTransactions: GiftTransaction[] = [
  {
    id: 'gtx_01',
    eventId: 'evt_teddy_afro_01',
    senderId: 'usr_02',
    senderName: 'Selamawit',
    giftId: 'g_guitar',
    giftName: 'Electric Guitar',
    emoji: '🎸',
    coins: 100,
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString()
  },
  {
    id: 'gtx_02',
    eventId: 'evt_teddy_afro_01',
    senderId: 'usr_03',
    senderName: 'Dawit G.',
    giftId: 'g_crown',
    giftName: 'Crown',
    emoji: '👑',
    coins: 500,
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  }
];

export class GiftService {
  static getCatalog(): VirtualGift[] {
    return GIFT_CATALOG;
  }

  static getWalletBalance(userId: string): number {
    return userWallets.get(userId) ?? 200; // default 200 welcome coins
  }

  static addCoins(userId: string, coins: number): number {
    const current = this.getWalletBalance(userId);
    const updated = current + coins;
    userWallets.set(userId, updated);
    return updated;
  }

  static sendGift(params: {
    eventId: string;
    userId: string;
    userName: string;
    giftId: string;
    count: number;
  }): { transaction: GiftTransaction; remainingBalance: number } {
    const gift = GIFT_CATALOG.find(g => g.id === params.giftId);
    if (!gift) {
      throw new AppError('Virtual gift does not exist.', 404, 'GIFT_NOT_FOUND');
    }

    const totalCoins = gift.coins * params.count;
    const currentBalance = this.getWalletBalance(params.userId);

    if (currentBalance < totalCoins) {
      throw new AppError(
        `Insufficient coin balance (${currentBalance} coins). You need ${totalCoins} coins. Please top up your wallet.`,
        400,
        'INSUFFICIENT_COINS'
      );
    }

    // Double-entry debit
    const remaining = currentBalance - totalCoins;
    userWallets.set(params.userId, remaining);

    const transaction: GiftTransaction = {
      id: `gtx_${Date.now()}`,
      eventId: params.eventId,
      senderId: params.userId,
      senderName: params.userName,
      giftId: gift.id,
      giftName: gift.name,
      emoji: gift.emoji,
      coins: totalCoins,
      timestamp: new Date().toISOString()
    };

    giftTransactions.unshift(transaction);
    return { transaction, remainingBalance: remaining };
  }

  static getRecentGifts(eventId: string): GiftTransaction[] {
    return giftTransactions.filter(g => g.eventId === eventId);
  }

  static getAllGiftTransactions(): GiftTransaction[] {
    return giftTransactions;
  }
}
