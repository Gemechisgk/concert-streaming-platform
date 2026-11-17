import { NextRequest, NextResponse } from 'next/server';
import { StreamService, ObsSwitcherService } from '@concert/business-logic';
import {
  CreateCameraSchema,
  UpdateCameraSchema,
  SwitchDirectorCameraSchema,
  UpdateCameraModeSchema
} from '@concert/validation';

/**
 * Administrative Multi-Camera Management API
 * Restricted to administrators and authorized production operators.
 */
export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get('eventId') || 'evt_veronica_01';
    const channel = StreamService.getChannelByEventId(eventId);
    const cameras = StreamService.getCamerasByEventId(eventId);
    const activeCamera = StreamService.getActiveLiveCamera(eventId);
    const obsStatus = ObsSwitcherService.getStatus();

    return NextResponse.json({
      eventId,
      cameraMode: channel?.cameraMode || 'DIRECTOR_CONTROLLED',
      activeCameraId: channel?.activeCameraId || activeCamera?.id,
      cameras,
      activeCamera,
      obsStatus
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CreateCameraSchema.parse(body);

    const newCamera = StreamService.addCamera(validated.eventId, {
      name: validated.name,
      description: validated.description,
      isDefault: validated.isDefault,
      ingestProtocol: validated.ingestProtocol
    });

    return NextResponse.json({ success: true, camera: newCamera }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Switch live camera in Director-Controlled Mode (with OBS WebSocket command dispatch)
    if (body.action === 'SWITCH_DIRECTOR_CAMERA') {
      const validated = SwitchDirectorCameraSchema.parse(body);
      const activeCamera = StreamService.switchDirectorCamera(
        validated.eventId,
        validated.cameraId,
        'operator_admin'
      );

      // Command OBS Studio over WebSocket to physically cut scene to the chosen camera
      const obsRes = await ObsSwitcherService.switchProgramScene(activeCamera.name);

      return NextResponse.json({
        success: true,
        activeCamera,
        obsScene: obsRes.sceneName,
        obsSwitched: obsRes.success
      });
    }

    // 2. Toggle stream operating mode (Director-Controlled vs Viewer-Selectable)
    if (body.action === 'UPDATE_CAMERA_MODE') {
      const validated = UpdateCameraModeSchema.parse(body);
      const newMode = StreamService.setCameraMode(validated.eventId, validated.cameraMode);
      return NextResponse.json({ success: true, cameraMode: newMode });
    }

    // 3. Set camera as default
    if (body.action === 'SET_DEFAULT' && body.cameraId && body.eventId) {
      const camera = StreamService.setDefaultCamera(body.eventId, body.cameraId);
      return NextResponse.json({ success: true, camera });
    }

    // 4. General camera update (name, description, status, vitals)
    if (body.cameraId && body.eventId) {
      const validated = UpdateCameraSchema.parse(body);
      const updated = StreamService.updateCamera(body.eventId, body.cameraId, validated);
      return NextResponse.json({ success: true, camera: updated });
    }

    return NextResponse.json({ error: 'Invalid PATCH action or missing camera parameters' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get('eventId');
    const cameraId = request.nextUrl.searchParams.get('cameraId');

    if (!eventId || !cameraId) {
      return NextResponse.json({ error: 'Missing eventId or cameraId' }, { status: 400 });
    }

    StreamService.removeCamera(eventId, cameraId);
    return NextResponse.json({ success: true, message: `Camera ${cameraId} removed.` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
