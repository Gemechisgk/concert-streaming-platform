import { NextResponse } from 'next/server';
import { AuthService, TicketService } from '@concert/business-logic';

export async function GET(request: Request) {
  // Check cookie or header
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  const cookieHeader = request.headers.get('cookie') || '';
  const cookieMatch = cookieHeader.match(/session_token=([^;]+)/);
  const cookieToken = cookieMatch ? cookieMatch[1] : undefined;

  const token = bearerToken || cookieToken || '';
  let user = token ? await AuthService.verifySession(token) : null;

  if (!user) {
    // Return default viewer for demo if not signed in
    user =
      AuthService.getAllUsers().find(u => u.roles.includes('VIEWER')) ||
      AuthService.getAllUsers()[2] ||
      AuthService.getAllUsers()[0];
  }

  // Fetch persistent and in-memory tickets for the user
  const tickets = await TicketService.getPersistentUserTickets(user.id, user.email);

  return NextResponse.json({ user, tickets });
}
