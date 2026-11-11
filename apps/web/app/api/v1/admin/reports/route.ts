import { NextResponse } from 'next/server';
import { AnalyticsService, StreamService, TicketService, AuthService } from '@concert/business-logic';

export async function GET() {
  const metrics = AnalyticsService.getAdminMetrics();
  const channels = StreamService.getAllChannels();
  const recentOrders = TicketService.getAllOrders().slice(0, 10);
  const users = AuthService.getAllUsers();

  return NextResponse.json({
    metrics,
    channels,
    recentOrders,
    users
  });
}
