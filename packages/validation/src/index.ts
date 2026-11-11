import { z } from 'zod';

// Authentication
export const RegisterSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phoneNumber: z.string().optional()
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});
export type LoginInput = z.infer<typeof LoginSchema>;

// Events
export const CreateEventSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  slug: z.string().min(3, 'Slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  tagline: z.string().min(5, 'Tagline is required'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  bannerImage: z.string().url('Banner image must be a valid URL'),
  thumbnailImage: z.string().url('Thumbnail image must be a valid URL'),
  venueName: z.string().min(2, 'Venue name is required'),
  venueCity: z.string().min(2, 'Venue city is required'),
  venueCountry: z.string().min(2, 'Venue country is required'),
  startTime: z.string().datetime('Start time must be ISO 8601 string'),
  endTime: z.string().datetime('End time must be ISO 8601 string'),
  featured: z.boolean().default(false)
});
export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const UpdateEventStatusSchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'LIVE', 'ENDED', 'ARCHIVED'])
});

// Ticketing & Checkout
export const OrderItemSchema = z.object({
  ticketTypeId: z.string().min(1, 'Ticket tier is required'),
  quantity: z.number().int().positive().max(10, 'Maximum 10 tickets per order')
});

export const CheckoutSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  items: z.array(OrderItemSchema).min(1, 'At least one ticket item is required'),
  currency: z.enum(['ETB', 'USD']).default('ETB'),
  paymentProvider: z.enum(['TELEBIRR', 'CBE_BIRR', 'CHAPA', 'ARIFPAY', 'STRIPE']),
  customerEmail: z.string().email(),
  customerName: z.string().min(2),
  customerPhone: z.string().optional(),
  idempotencyKey: z.string().min(8)
});
export type CheckoutInput = z.infer<typeof CheckoutSchema>;

// Streaming
export const StreamTokenRequestSchema = z.object({
  ticketCode: z.string().min(5, 'Ticket code is required'),
  eventId: z.string().min(1, 'Event ID is required')
});

export const StreamHeartbeatSchema = z.object({
  streamToken: z.string().min(10),
  playbackPositionSeconds: z.number().optional(),
  bitrateKbps: z.number().optional(),
  bufferHealth: z.number().optional(),
  dropFrames: z.number().optional()
});

// SRS Webhooks
export const SrsPublishHookSchema = z.object({
  action: z.literal('on_publish'),
  client_id: z.number().or(z.string()),
  ip: z.string(),
  vhost: z.string(),
  app: z.string(),
  stream: z.string(),
  param: z.string().optional()
});

export const SrsPlayHookSchema = z.object({
  action: z.literal('on_play'),
  client_id: z.number().or(z.string()),
  ip: z.string(),
  vhost: z.string(),
  app: z.string(),
  stream: z.string(),
  param: z.string().optional()
});

// Chat & Gifts
export const SendChatMessageSchema = z.object({
  eventId: z.string().min(1),
  text: z.string().min(1, 'Message cannot be empty').max(300, 'Message cannot exceed 300 characters')
});

export const SendGiftSchema = z.object({
  eventId: z.string().min(1),
  giftId: z.string().min(1),
  count: z.number().int().positive().max(50).default(1)
});

export const ChatModerationActionSchema = z.object({
  action: z.enum(['DELETE', 'PIN', 'BAN_USER']),
  messageId: z.string().optional(),
  targetUserId: z.string().optional(),
  reason: z.string().optional()
});
