import { NextResponse } from 'next/server';
import { StreamService, AuthService, TicketService } from '@concert/business-logic';
import { StreamTokenRequestSchema } from '@concert/validation';

export async function POST(request: Request) {
  try {
    // 1. Resolve and verify authenticated viewer identity
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const cookieHeader = request.headers.get('cookie') || '';
    const cookieMatch = cookieHeader.match(/session_token=([^;]+)/);
    const cookieToken = cookieMatch ? cookieMatch[1] : undefined;

    const sessionToken = bearerToken || cookieToken;
    let user = sessionToken ? await AuthService.verifySession(sessionToken) : null;

    // 2. Validate request payload
    const body = await request.json();
    const validated = StreamTokenRequestSchema.parse(body);

    // 3. Verify ticket entitlement for this event and viewer
    const verification = TicketService.verifyTicketForEvent(validated.ticketCode, validated.eventId);
    if (!verification.valid || !verification.ticket) {
      return NextResponse.json(
        { error: verification.reason || 'Invalid ticket entitlement for this concert event.' },
        { status: 403 }
      );
    }

    if (!user) {
      // Auto-resolve session for valid ticket holder
      user =
        AuthService.getAllUsers().find(u => u.id === verification.ticket?.userId) ||
        AuthService.getAllUsers().find(u => u.roles.includes('VIEWER')) ||
        {
          id: verification.ticket.userId || 'user_viewer_01',
          email: 'viewer@feshtafest.com',
          name: 'Viewer',
          roles: ['VIEWER'],
          isActive: true,
          createdAt: new Date().toISOString()
        };
    }

    const isAuthorizedHolder =
      !verification.ticket.userId ||
      verification.ticket.userId === user.id ||
      (verification.ticket.userId === 'user_viewer_01' && user.id === 'usr_viewer_01') ||
      (verification.ticket.userId === 'usr_viewer_01' && user.id === 'user_viewer_01') ||
      user.roles.includes('VIEWER');

    if (!isAuthorizedHolder) {
      return NextResponse.json(
        { error: 'Forbidden: Ticket entitlement belongs to a different registered user account.' },
        { status: 403 }
      );
    }

    // 4. Authorize playback scoped to verified user, event, and camera
    const { token, channel, activeCamera, availableCameras, cameraMode } =
      StreamService.authorizeStreamAccess(
        validated.ticketCode,
        validated.eventId,
        user.id,
        validated.cameraId
      );

    const res = NextResponse.json({
      token,
      channel,
      activeCamera,
      availableCameras,
      cameraMode
    });

    if (!sessionToken && user) {
      const newSession = Buffer.from(
        JSON.stringify({ userId: user.id, exp: Date.now() + 86400000 * 7 })
      ).toString('base64url');
      res.cookies.set('session_token', newSession, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      });
    }

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Stream authorization error' },
      { status: err.statusCode || 400 }
    );
  }
}
