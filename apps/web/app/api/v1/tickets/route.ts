import { NextResponse } from 'next/server';
import { TicketService } from '@concert/business-logic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  const userId = searchParams.get('userId') || 'user_viewer_01';

  if (eventId) {
    const ticketTypes = TicketService.getTicketTypesForEvent(eventId);
    return NextResponse.json({ ticketTypes });
  }

  const userTickets = TicketService.getUserTickets(userId);
  return NextResponse.json({ tickets: userTickets });
}
