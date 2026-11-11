// System Roles (Section 6)
export type SystemRole =
  | 'SUPER_ADMIN'
  | 'EVENT_ADMIN'
  | 'EVENT_MANAGER'
  | 'FINANCE_MANAGER'
  | 'CUSTOMER_SUPPORT'
  | 'CHAT_MODERATOR'
  | 'VIEWER';

// User & Profile
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  phoneNumber?: string;
  roles: SystemRole[];
  isActive: boolean;
  createdAt: string;
}

// Event Lifecycle Status (Section 7 Module 2)
export type EventStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'SCHEDULED'
  | 'LIVE'
  | 'ENDED'
  | 'ARCHIVED';

export interface Artist {
  id: string;
  name: string;
  role: string; // e.g. "Lead Vocalist", "Electronic Producer", "Special Guest"
  bio: string;
  imageUrl: string;
}

export interface EventScheduleItem {
  id: string;
  stageName: string;
  title: string;
  artistName: string;
  startTime: string;
  endTime: string;
}

export interface ConcertEvent {
  id: string;
  title: string;
  slug: string;
  tagline: string;
  description: string;
  bannerImage: string;
  thumbnailImage: string;
  status: EventStatus;
  venueName: string;
  venueCity: string;
  venueCountry: string;
  startTime: string;
  endTime: string;
  artists: Artist[];
  schedule: EventScheduleItem[];
  streamChannelId?: string;
  featured?: boolean;
}

// Ticketing (Section 7 Module 3)
export type TicketTier =
  | 'EARLY_BIRD'
  | 'STANDARD'
  | 'VIP'
  | 'PREMIUM'
  | 'COMPLIMENTARY';

export interface TicketType {
  id: string;
  eventId: string;
  name: TicketTier;
  displayName: string;
  description: string;
  priceInCents: number; // minor units (e.g. 50000 = 500.00 ETB / USD)
  currency: 'ETB' | 'USD';
  capacity: number;
  soldCount: number;
  perks: string[];
  maxPerUser: number;
  salesStartTime: string;
  salesEndTime: string;
  isSoldOut?: boolean;
}

export interface Ticket {
  id: string;
  orderId: string;
  userId: string;
  ticketTypeId: string;
  ticketCode: string;
  qrCodeUrl: string;
  status: 'ACTIVE' | 'USED' | 'REVOKED';
  streamToken?: string;
  event: ConcertEvent;
  ticketType: TicketType;
  issuedAt: string;
}

// Orders & Checkout
export type OrderStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';

export interface OrderItem {
  ticketTypeId: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Order {
  id: string;
  userId: string;
  orderNumber: string;
  items: OrderItem[];
  totalAmountCents: number;
  currency: 'ETB' | 'USD';
  status: OrderStatus;
  paymentProvider?: PaymentProviderType;
  paymentReference?: string;
  createdAt: string;
}

// Payment Gateways (Section 7 Module 4)
export type PaymentProviderType =
  | 'TELEBIRR'
  | 'CBE_BIRR'
  | 'CHAPA'
  | 'ARIFPAY'
  | 'STRIPE';

export interface PaymentInitializationResult {
  paymentId: string;
  orderId: string;
  provider: PaymentProviderType;
  checkoutUrl?: string;
  qrCodeData?: string;
  reference: string;
  amountCents: number;
  currency: string;
}

// Streaming Infrastructure (Section 7 Module 5 & 6)
export interface StreamQualityProfile {
  name: '1080p' | '720p' | '480p' | '360p' | 'Auto';
  bitrateKbps: number;
  resolution: string;
  playlistUrl: string;
}

export interface StreamChannel {
  id: string;
  eventId: string;
  status: 'OFFLINE' | 'INGESTING' | 'LIVE' | 'ENDED';
  hlsMasterUrl: string;
  fallbackMp4Url?: string;
  qualities: StreamQualityProfile[];
  primaryIngestRtmp: string;
  backupIngestRtmp: string;
  streamKey: string;
  fps: number;
  currentBitrateKbps: number;
  dropFrames: number;
}

export interface PlaybackSession {
  sessionId: string;
  ticketId: string;
  userId: string;
  eventId: string;
  streamToken: string;
  startedAt: string;
  expiresAt: string;
  lastHeartbeat: string;
}

// Live Chat & Moderation (Section 7 Module 7)
export interface ChatMessage {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userRole?: SystemRole;
  text: string;
  timestamp: string;
  isPinned?: boolean;
  isSystem?: boolean;
}

// Virtual Gifts & Wallet (Section 7 Module 8)
export interface VirtualGift {
  id: string;
  name: string;
  emoji: string;
  coins: number;
  priceCents: number;
  animation: 'sparkle' | 'fireworks' | 'guitar' | 'heart' | 'crown';
}

export interface GiftTransaction {
  id: string;
  eventId: string;
  senderId: string;
  senderName: string;
  giftId: string;
  giftName: string;
  emoji: string;
  coins: number;
  timestamp: string;
}

// Replays / VOD (Section 7 Module 9)
export interface ReplayAsset {
  id: string;
  eventId: string;
  title: string;
  thumbnailUrl: string;
  vodManifestUrl: string;
  durationSeconds: number;
  availableUntil: string;
  isIncludedInTicket: boolean;
}

// Admin Overview Telemetry
export interface AdminMetrics {
  totalUsers: number;
  registeredViewers: number;
  upcomingEvents: number;
  liveEvents: number;
  ticketSalesTotal: number;
  totalRevenueCents: number;
  currency: string;
  activeViewersCount: number;
  giftsTotalAmountCents: number;
}
