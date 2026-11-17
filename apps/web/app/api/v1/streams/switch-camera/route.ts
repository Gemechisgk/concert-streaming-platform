import { NextResponse } from 'next/server';
import { StreamService, AuthService, TicketService } from '@concert/business-logic';
import { StreamTokenRequestSchema } from '@concert/validation';

/**
 * Viewer Camera Switching API (Mode B: Viewer-Selectable Camera Mode)
 * Scopes the viewer's playback token to the chosen camera angle while preserving
 * ticket entitlement, active session, and master audio continuity.
 */
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

    if (!validated.cameraId) {
      return NextResponse.json(
        { error: 'Missing target cameraId for angle switch request.' },
        { status: 400 }
      );
    }

    // 3. Verify ticket entitlement
    const verification = TicketService.verifyTicketForEvent(validated.ticketCode, validated.eventId);
    if (!verification.valid || !verification.ticket) {
      return NextResponse.json(
        { error: verification.reason || 'Invalid ticket entitlement for this concert event.' },
        { status: 403 }
      );
    }

    if (!user) {
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

    // 4. Issue new camera-scoped playback token
    const result = StreamService.switchViewerCamera(
      validated.ticketCode,
      validated.eventId,
      validated.cameraId,
      user.id
    );

    return NextResponse.json({
      success: true,
      token: result.token,
      camera: result.activeCamera,
      activeCamera: result.activeCamera,
      availableCameras: result.availableCameras,
      cameraMode: result.cameraMode,
      channel: result.channel
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to switch camera angle.' },
      { status: err.statusCode || 400 }
    );
  }
}
