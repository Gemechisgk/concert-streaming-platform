import { NextResponse } from 'next/server';
import { EventService, TicketService } from '@concert/business-logic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = EventService.getEventBySlug(slug);
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const ticketTypes = TicketService.getTicketTypesForEvent(event.id);
  return NextResponse.json({ event, ticketTypes });
}
