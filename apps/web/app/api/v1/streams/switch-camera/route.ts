import { NextResponse } from 'next/server';
import { StreamService } from '@concert/business-logic';
import { StreamTokenRequestSchema } from '@concert/validation';

/**
 * Viewer Camera Switching API (Mode B: Viewer-Selectable Camera Mode)
 * Scopes the viewer's playback token to the chosen camera angle while preserving
 * ticket entitlement, active session, and master audio continuity.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = StreamTokenRequestSchema.parse(body);

    const { token, channel, activeCamera, availableCameras, cameraMode } =
      StreamService.authorizeStreamAccess(
        validated.ticketCode,
        validated.eventId,
        'user_viewer_01',
        validated.cameraId
      );

    return NextResponse.json({
      success: true,
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
