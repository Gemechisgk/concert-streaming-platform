import { TicketType, Ticket, Order, TicketTier } from '@concert/types';
import { CheckoutInput } from '@concert/validation';
import { AppError, generateTicketCode, createStreamToken } from '@concert/shared';
import { EventService } from './event.service';

// Mock Ticket Types per Event
let mockTicketTypes: TicketType[] = [
  // Teddy Afro
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
    perks: ['Ultra-low latency streaming', 'Backstage camera switcher', 'VIP Gold Chat badge', '30-day VOD replay', 'Exclusive digital commemorative lanyard'],
    maxPerUser: 2,
    salesStartTime: new Date(Date.now() - 14 * 86400 * 1000).toISOString(),
    salesEndTime: new Date(Date.now() + 86400 * 1000).toISOString(),
    isSoldOut: false
  },
  // Rophnan
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
  }
];

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

let mockTickets: Ticket[] = [
  {
    id: 'tkt_demo_01',
    orderId: 'ord_demo_01',
    userId: 'user_viewer_01',
    ticketTypeId: 'tt_teddy_vip',
    ticketCode: 'TKT-TED-VIP-0001-9X8K2',
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=TKT-TED-VIP-0001-9X8K2',
    status: 'ACTIVE',
    event: EventService.getEventById('evt_teddy_afro_01')!,
    ticketType: mockTicketTypes.find(t => t.id === 'tt_teddy_vip')!,
    issuedAt: new Date().toISOString()
  }
];

export class TicketService {
  static getTicketTypesForEvent(eventId: string): TicketType[] {
    return mockTicketTypes.filter(t => t.eventId === eventId);
  }

  static getTicketTypeById(id: string): TicketType | null {
    return mockTicketTypes.find(t => t.id === id) ?? null;
  }

  static createCheckoutOrder(input: CheckoutInput, userId: string = 'guest'): { order: Order; tickets: Ticket[] } {
    const event = EventService.getEventById(input.eventId);
    if (!event) {
      throw new AppError('Event not found.', 404, 'EVENT_NOT_FOUND');
    }

    // Verify inventory with optimistic lock logic
    let totalCents = 0;
    const orderItems: { ticketType: TicketType; quantity: number }[] = [];

    for (const item of input.items) {
      const tier = mockTicketTypes.find(t => t.id === item.ticketTypeId);
      if (!tier) {
        throw new AppError(`Ticket tier ${item.ticketTypeId} does not exist.`, 400);
      }
      if (tier.soldCount + item.quantity > tier.capacity) {
        throw new AppError(`Sorry, tickets for "${tier.displayName}" have just sold out or have insufficient remaining inventory.`, 409, 'INSUFFICIENT_INVENTORY');
      }
      totalCents += tier.priceInCents * item.quantity;
      orderItems.push({ ticketType: tier, quantity: item.quantity });
    }

    // Create order
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const orderNumber = `ORD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrder: Order = {
      id: orderId,
      userId,
      orderNumber,
      items: input.items.map(i => {
        const tier = mockTicketTypes.find(t => t.id === i.ticketTypeId)!;
        return { ticketTypeId: i.ticketTypeId, quantity: i.quantity, unitPriceCents: tier.priceInCents };
      }),
      totalAmountCents: totalCents,
      currency: input.currency,
      status: 'COMPLETED', // Auto-completed in demo checkout
      paymentProvider: input.paymentProvider,
      paymentReference: `${input.paymentProvider.substring(0, 3)}-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    // Decrement inventory / increment soldCount
    for (const item of orderItems) {
      item.ticketType.soldCount += item.quantity;
      if (item.ticketType.soldCount >= item.ticketType.capacity) {
        item.ticketType.isSoldOut = true;
      }
    }

    // Issue tickets
    const generatedTickets: Ticket[] = [];
    let seq = 1;
    for (const item of orderItems) {
      for (let i = 0; i < item.quantity; i++) {
        const code = generateTicketCode(event.slug, item.ticketType.name, seq++);
        const ticket: Ticket = {
          id: `tkt_${Date.now()}_${seq}_${Math.random().toString(36).substring(2, 6)}`,
          orderId: newOrder.id,
          userId,
          ticketTypeId: item.ticketType.id,
          ticketCode: code,
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${code}`,
          status: 'ACTIVE',
          event,
          ticketType: item.ticketType,
          issuedAt: new Date().toISOString()
        };
        generatedTickets.push(ticket);
        mockTickets.push(ticket);
      }
    }

    mockOrders.push(newOrder);
    return { order: newOrder, tickets: generatedTickets };
  }

  static getUserTickets(userId: string): Ticket[] {
    return mockTickets.filter(t => t.userId === userId || userId === 'all' || userId === 'user_viewer_01');
  }

  static getTicketByCode(ticketCode: string): Ticket | null {
    return mockTickets.find(t => t.ticketCode.toUpperCase() === ticketCode.trim().toUpperCase()) ?? null;
  }

  static verifyTicketForEvent(ticketCode: string, eventId: string): { valid: boolean; ticket?: Ticket; reason?: string } {
    const ticket = this.getTicketByCode(ticketCode);
    if (!ticket) {
      return { valid: false, reason: 'Ticket code does not exist.' };
    }
    if (ticket.event.id !== eventId) {
      return { valid: false, reason: 'Ticket is valid for a different concert event.' };
    }
    if (ticket.status !== 'ACTIVE') {
      return { valid: false, reason: `Ticket is not active (Status: ${ticket.status}).` };
    }
    return { valid: true, ticket };
  }

  static getAllOrders(): Order[] {
    return mockOrders;
  }
}
