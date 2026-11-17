import { TicketType, Ticket, Order, TicketTier } from '@concert/types';
import { CheckoutInput } from '@concert/validation';
import { AppError } from '@concert/shared';
import { prisma } from '@concert/database';
import { EventService } from './event.service';

// Mock Ticket Types per Event - single source of truth matching events in event.service.ts
// Fixed: removed duplicate/disconnected demo items, using consistent event IDs
let mockTicketTypes: TicketType[] = [
  // Teddy Afro Live in Addis - Millennium Celebration
  {
    id: 'tt_teddy_early',
    eventId: 'evt_teddy_afro_01',
    name: 'EARLY_BIRD',
    displayName: 'Early Bird Pass',
    description: '1080p full concert live access + 24-hr replay pass',
    priceInCents: 25000, // 250.00 ETB
    currency: 'ETB',
    capacity: 5000,
    soldCount: 5000,
    perks: ['1080p HD live broadcast', '24-hour replay pass', 'Public live chat badge'],
    maxPerUser: 4,
    salesStartTime: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
    salesEndTime: new Date(Date.now() - 5 * 86400 * 1000).toISOString(),
    isSoldOut: true
  },
  {
    id: 'tt_teddy_std',
    eventId: 'evt_teddy_afro_01',
    name: 'STANDARD',
    displayName: 'Standard Live Pass',
    description: 'High-definition live stream with real-time interactive audience chat',
    priceInCents: 40000, // 400.00 ETB
    currency: 'ETB',
    capacity: 25000,
    soldCount: 18450,
    perks: ['Adaptive HD video (up to 1080p60)', 'Audience chat participation', 'Virtual gift reaction capability'],
    maxPerUser: 6,
    salesStartTime: new Date(Date.now() - 14 * 86400 * 1000).toISOString(),
    salesEndTime: new Date(Date.now() + 86400 * 1000).toISOString(),
    isSoldOut: false
  },
  {
    id: 'tt_teddy_vip',
    eventId: 'evt_teddy_afro_01',
    name: 'VIP',
    displayName: 'VIP Backstage Digital Pass',
    description: 'Ultra-low latency stream, exclusive backstage feed, VIP gold chat badge, and 30-day VOD library access',
    priceInCents: 90000, // 900.00 ETB
    currency: 'ETB',
    capacity: 3000,
    soldCount: 2210,
    perks: ['Spatial audio master feed', 'VIP gold chat badge', 'Multi-camera angle selector', '30-day VOD replay pass'],
    maxPerUser: 2,
    salesStartTime: new Date(Date.now() - 10 * 86400 * 1000).toISOString(),
    salesEndTime: new Date(Date.now() + 5 * 86400 * 1000).toISOString(),
    isSoldOut: false
  },
  // Rophnan: MYSTICS Electronic Live Spectacle
  {
    id: 'tt_rophnan_std',
    eventId: 'evt_rophnan_02',
    name: 'STANDARD',
    displayName: 'Standard Rave Stream Pass',
    description: 'Live electronic stage feed, synchronized visuals, chat access',
    priceInCents: 35000, // 350.00 ETB
    currency: 'ETB',
    capacity: 15000,
    soldCount: 4200,
    perks: ['1080p ABR HLS feed', 'Live chat access', 'Digital poster download'],
    maxPerUser: 4,
    salesStartTime: new Date(Date.now() - 10 * 86400 * 1000).toISOString(),
    salesEndTime: new Date(Date.now() + 5 * 86400 * 1000).toISOString(),
    isSoldOut: false
  },
  {
    id: 'tt_rophnan_vip',
    eventId: 'evt_rophnan_02',
    name: 'VIP',
    displayName: 'VIP Spatial Experience Pass',
    description: '3D Spatial audio stream, VIP visual stream feed, and backstage interview access',
    priceInCents: 75000, // 750.00 ETB
    currency: 'ETB',
    capacity: 2000,
    soldCount: 1100,
    perks: ['Spatial audio master feed', 'VIP chat privileges', 'Multi-camera angle selector', 'Replay VOD pass'],
    maxPerUser: 2,
    salesStartTime: new Date(Date.now() - 10 * 86400 * 1000).toISOString(),
    salesEndTime: new Date(Date.now() + 5 * 86400 * 1000).toISOString(),
    isSoldOut: false
  },
  // Aster Aweke: Timeless Soul & Ballads
  {
    id: 'tt_aster_vod',
    eventId: 'evt_aster_03',
    name: 'STANDARD',
    displayName: 'Replay VOD Pass',
    description: 'Unlimited 4K replay access to the archived concert performance',
    priceInCents: 30000, // 300.00 ETB
    currency: 'ETB',
    capacity: 50000,
    soldCount: 8900,
    perks: ['4K replay access', 'Lossless stereo audio', 'Unlimited replay watching'],
    maxPerUser: 4,
    salesStartTime: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
    salesEndTime: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
    isSoldOut: false
  },
  // SRS & OBS Studio Production Pipeline Rehearsal
  {
    id: 'tt_srs_rehearsal_pass',
    eventId: 'evt_srs_rehearsal_04',
    name: 'VIP',
    displayName: 'SRS Pipeline Verification Pass',
    description: 'Full-pipeline OBS to SRS ingest, multi-bitrate ABR HLS, and signed token access pass',
    priceInCents: 1000, // 10.00 ETB
    currency: 'ETB',
    capacity: 10000,
    soldCount: 1,
    perks: ['Low-latency HLS stream', 'Multi-bitrate ABR switcher', 'Ingest health telemetry'],
    maxPerUser: 10,
    salesStartTime: new Date(Date.now() - 30 * 86400 * 1000).toISOString(),
    salesEndTime: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
    isSoldOut: false
  },
  // Backward compatibility: Veronica Adane event tickets
  {
    id: 'tt_veronica_vip',
    eventId: 'evt_veronica_01',
    name: 'VIP',
    displayName: 'VIP Backstage Digital Pass',
    description: 'Ultra-low latency stream, exclusive backstage feed, VIP gold chat badge, and 30-day VOD library access',
    priceInCents: 90000, // 900.00 ETB
    currency: 'ETB',
    capacity: 5000,
    soldCount: 4210,
    perks: ['Spatial audio master feed', 'VIP gold chat badge', 'Multi-camera angle selector', '30-day VOD replay pass'],
    maxPerUser: 2,
    salesStartTime: new Date(Date.now() - 10 * 86400 * 1000).toISOString(),
    salesEndTime: new Date(Date.now() + 5 * 86400 * 1000).toISOString(),
    isSoldOut: false
  }
];

// Generate ticket codes for demo purposes
function generateTicketCode(): string {
  const randomChars = Math.random().toString(36).substring(2, 12).toUpperCase();
  const seqPadded = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TKT-${seqPadded}-${randomChars}`;
}

let mockOrders: Order[] = [
  {
    id: 'ord_demo_01',
    userId: 'user_viewer_01',
    orderNumber: 'ORD-2026-9921',
    items: [{ ticketTypeId: 'tt_teddy_vip', quantity: 1, unitPriceCents: 90000 }],
    totalAmountCents: 90000,
    currency: 'ETB',
    status: 'COMPLETED',
    paymentProvider: 'TELEBIRR',
    paymentReference: 'TB-998217342',
    createdAt: new Date().toISOString()
  }
];

let mockTickets: Ticket[] = [];
let mockTicketsInitialized = false;

function initializeMockTickets(): void {
  if (mockTicketsInitialized) return;
  
  const teddyEvent = EventService.getEventById('evt_teddy_afro_01');
  const veronicaEvent = EventService.getEventById('evt_veronica_01');
  const srsEvent = EventService.getEventById('evt_srs_rehearsal_04');
  
  const teddyTicketType = mockTicketTypes.find(t => t.id === 'tt_teddy_vip');
  const veronicaTicketType = mockTicketTypes.find(t => t.id === 'tt_veronica_vip');
  const srsTicketType = mockTicketTypes.find(t => t.id === 'tt_srs_rehearsal_pass');
  
  if (teddyEvent && teddyTicketType) {
    mockTickets.push({
      id: 'tkt_demo_01',
      orderId: 'ord_demo_01',
      userId: 'user_viewer_01',
      ticketTypeId: 'tt_teddy_vip',
      ticketCode: 'TKT-TED-VIP-0001-9X8K2',
      qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=TKT-TED-VIP-0001-9X8K2',
      status: 'ACTIVE',
      event: teddyEvent,
      ticketType: teddyTicketType,
      issuedAt: new Date().toISOString()
    });
  }
  
  if (veronicaEvent && veronicaTicketType) {
    mockTickets.push({
      id: 'tkt_veronica_01',
      orderId: 'ord_ver_01',
      userId: 'user_viewer_01',
      ticketTypeId: 'tt_veronica_vip',
      ticketCode: 'TKT-VER-VIP-0001-TEST1',
      qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=TKT-VER-VIP-0001-TEST1',
      status: 'ACTIVE',
      event: veronicaEvent,
      ticketType: veronicaTicketType,
      issuedAt: new Date().toISOString()
    });
  }
  
  if (srsEvent && srsTicketType) {
    mockTickets.push({
      id: 'tkt_srs_01',
      orderId: 'ord_srs_01',
      userId: 'user_viewer_01',
      ticketTypeId: 'tt_srs_rehearsal_pass',
      ticketCode: 'TKT-SRS-VIP-0001-TEST8',
      qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=TKT-SRS-VIP-0001-TEST8',
      status: 'ACTIVE',
      event: srsEvent,
      ticketType: srsTicketType,
      issuedAt: new Date().toISOString()
    });
  }
  
  mockTicketsInitialized = true;
}

export class TicketService {
  static getTicketTypesForEvent(eventId: string): TicketType[] {
    return mockTicketTypes.filter(t => t.eventId === eventId);
  }

  static getTicketTypeById(id: string): TicketType | null {
    return mockTicketTypes.find(t => t.id === id) ?? null;
  }

  static createCheckoutOrder(input: CheckoutInput, userId: string = 'guest'): { order: Order; tickets: Ticket[] } {
    initializeMockTickets();
    // Simplified checkout for demo purposes
    // Get the first ticket type from items array
    const firstItem = input.items[0];
    const ticketType = this.getTicketTypeById(firstItem.ticketTypeId);
    if (!ticketType) {
      throw new AppError('Ticket type not found', 404, 'TICKET_NOT_FOUND');
    }
    
    const order: Order = {
      id: `ord_${Date.now()}`,
      userId,
      orderNumber: `ORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000)}`,
      items: input.items.map(i => ({
        ticketTypeId: i.ticketTypeId,
        quantity: i.quantity,
        unitPriceCents: ticketType.priceInCents
      })),
      totalAmountCents: ticketType.priceInCents * firstItem.quantity,
      currency: ticketType.currency,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    
    mockOrders.push(order);
    
    const ticketTypeObj = this.getTicketTypeById(firstItem.ticketTypeId);
    const eventObj = EventService.getEventById(ticketType.eventId);
    
    const tickets: Ticket[] = Array.from({ length: firstItem.quantity }).map((_, idx) => ({
      id: `tkt_${Date.now()}_${idx}`,
      orderId: order.id,
      userId,
      ticketTypeId: firstItem.ticketTypeId,
      ticketCode: generateTicketCode(),
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=TKT-${Date.now()}-${idx}`,
      status: 'ACTIVE',
      event: eventObj!,
      ticketType: ticketTypeObj!,
      issuedAt: new Date().toISOString()
    }));
    
    mockTickets.push(...tickets);
    
    return { order, tickets };
  }

  static getUserTickets(userId: string): Ticket[] {
    initializeMockTickets();
    return mockTickets.filter(t => t.userId === userId);
  }

  static getTicketByCode(ticketCode: string): Ticket | null {
    initializeMockTickets();
    return mockTickets.find(t => t.ticketCode === ticketCode) ?? null;
  }

  static verifyTicketForEvent(ticketCode: string, eventId: string): { valid: boolean; ticket?: Ticket; reason?: string } {
    initializeMockTickets();
    const ticket = this.getTicketByCode(ticketCode);
    if (!ticket) {
      return { valid: false, reason: 'Ticket not found' };
    }
    
    if (ticket.event.id !== eventId) {
      return { valid: false, reason: 'Ticket does not match this event' };
    }
    
    if (ticket.status !== 'ACTIVE') {
      return { valid: false, reason: 'Ticket is not active' };
    }
    
    return { valid: true, ticket };
  }

  static getAllOrders(): Order[] {
    return mockOrders;
  }

  static async getPersistentUserTickets(userId: string, userEmail?: string): Promise<Ticket[]> {
    initializeMockTickets();
    // For demo, return mock tickets
    return mockTickets.filter(t => t.userId === userId);
  }
}
