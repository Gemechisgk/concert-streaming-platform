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

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication session required to request stream authorization.' },
        { status: 401 }
      );
    }

    const user = await AuthService.verifySession(sessionToken);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or expired session. Please sign in again.' },
        { status: 401 }
      );
    }

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

    if (verification.ticket.userId && verification.ticket.userId !== user.id) {
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

    return NextResponse.json({
      token,
      channel: {
        id: channel.id,
        status: channel.status,
        hlsMasterUrl: channel.hlsMasterUrl,
        qualities: channel.qualities
      },
      activeCamera,
      availableCameras,
      cameraMode
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 400 });
  }
}
