import { NextRequest, NextResponse } from 'next/server';
import { StreamService } from '@concert/business-logic';

/**
 * Public Client Camera Discovery API
 * Safely returns camera angles for viewer selection without exposing stream keys or credentials.
 */
export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get('eventId') || 'evt_veronica_01';
    const channel = StreamService.getChannelByEventId(eventId);
    const cameras = StreamService.getPublicCamerasByEventId(eventId);
    const activeCamera = StreamService.getActiveLiveCamera(eventId);

    const publicActive = activeCamera
      ? {
          id: activeCamera.id,
          eventId: activeCamera.eventId,
          name: activeCamera.name,
          description: activeCamera.description,
          cameraIndex: activeCamera.cameraIndex,
          hlsMasterUrl: activeCamera.hlsMasterUrl,
          isDefault: activeCamera.isDefault,
          isActiveLive: activeCamera.isActiveLive,
          status: activeCamera.status,
          fps: activeCamera.fps,
          bitrateKbps: activeCamera.bitrateKbps
        }
      : null;

    return NextResponse.json({
      eventId,
      cameraMode: channel?.cameraMode || 'DIRECTOR_CONTROLLED',
      activeCameraId: channel?.activeCameraId || activeCamera?.id,
      cameras,
      activeCamera: publicActive
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
