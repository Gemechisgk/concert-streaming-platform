import { NextResponse } from 'next/server';
import { AuthService, TicketService } from '@concert/business-logic';

export async function GET(request: Request) {
  // Check cookie or header
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
  const user = await AuthService.verifySession(token);

  if (!user) {
    // Return default viewer for demo if not signed in
    const defaultUser = AuthService.getAllUsers()[1];
    const tickets = TicketService.getUserTickets(defaultUser.id);
    return NextResponse.json({ user: defaultUser, tickets });
  }

  const tickets = TicketService.getUserTickets(user.id);
  return NextResponse.json({ user, tickets });
}
