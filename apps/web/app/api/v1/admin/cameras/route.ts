import { NextRequest, NextResponse } from 'next/server';
import { StreamService, ObsSwitcherService, AuthService } from '@concert/business-logic';
import {
  CreateCameraSchema,
  UpdateCameraSchema,
  SwitchDirectorCameraSchema,
  UpdateCameraModeSchema
} from '@concert/validation';

async function requireProductionOperator(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  const cookieToken = request.cookies.get('session_token')?.value;
  const sessionToken = bearerToken || cookieToken;

  if (sessionToken) {
    const user = await AuthService.verifySession(sessionToken);
    if (user && user.roles.some(r => ['SUPER_ADMIN', 'EVENT_ADMIN', 'EVENT_MANAGER'].includes(r))) {
      return user;
    }
    throw new Error('Forbidden: Insufficient administrative privileges for camera operations.');
  }

  // If running in development/local test mode without headers, allow root admin
  if (process.env.NODE_ENV !== 'production') {
    const rootAdmin = AuthService.getAllUsers().find(u => u.roles.includes('SUPER_ADMIN'));
    if (rootAdmin) return rootAdmin;
  }

  throw new Error('Unauthorized: Authentication session required.');
}

/**
 * Administrative Multi-Camera Management API
 * Restricted to administrators and authorized production operators.
 */
export async function GET(request: NextRequest) {
  try {
    await requireProductionOperator(request);

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
    const status = err.message.includes('Unauthorized') ? 401 : err.message.includes('Forbidden') ? 403 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireProductionOperator(request);

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
    const status = err.message.includes('Unauthorized') ? 401 : err.message.includes('Forbidden') ? 403 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const operator = await requireProductionOperator(request);
    const body = await request.json();

    // 1. Switch live camera in Director-Controlled Mode (with OBS WebSocket command dispatch)
    if (body.action === 'SWITCH_DIRECTOR_CAMERA') {
      const validated = SwitchDirectorCameraSchema.parse(body);
      const activeCamera = StreamService.switchDirectorCamera(
        validated.eventId,
        validated.cameraId,
        operator.id
      );

      // Command OBS Studio over WebSocket to physically cut scene to the chosen camera
      const obsRes = await ObsSwitcherService.switchProgramScene(activeCamera.name);

      return NextResponse.json({
        success: true,
        activeCamera,
        obsScene: obsRes.sceneName,
        obsSwitched: obsRes.success,
        obsError: obsRes.error
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
    const status = err.message.includes('Unauthorized') ? 401 : err.message.includes('Forbidden') ? 403 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireProductionOperator(request);

    const eventId = request.nextUrl.searchParams.get('eventId');
    const cameraId = request.nextUrl.searchParams.get('cameraId');

    if (!eventId || !cameraId) {
      return NextResponse.json({ error: 'Missing eventId or cameraId' }, { status: 400 });
    }

    StreamService.removeCamera(eventId, cameraId);
    return NextResponse.json({ success: true, message: `Camera ${cameraId} removed.` });
  } catch (err: any) {
    const status = err.message.includes('Unauthorized') ? 401 : err.message.includes('Forbidden') ? 403 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
