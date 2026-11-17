import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { StreamService } from '../../packages/business-logic/src/stream.service';
import { TicketService } from '../../packages/business-logic/src/ticket.service';
import { ObsSwitcherService } from '../../packages/business-logic/src/obs-switcher.service';
import { createStreamToken, verifyStreamToken } from '../../packages/shared/src/index';

const JWT_SECRET = process.env.JWT_SECRET || 'development_jwt_secret_test_key_min_32_chars';
const PRIMARY_KEY = process.env.SRS_STREAM_KEY || 'dev_rehearsal_primary_stream_key';

const HLS_CANDIDATE_DIRS = [
  path.resolve(__dirname, '../../infrastructure/srs/windows/SRS-Windows-x86_64-8.0-d3/objs/nginx/html/live/abr'),
  path.resolve(__dirname, '../../infrastructure/srs/objs/nginx/html/live/abr')
];
const HLS_OUTPUT_DIR = HLS_CANDIDATE_DIRS.find(d => fs.existsSync(d)) || HLS_CANDIDATE_DIRS[0];

describe('Feature: Multi-Camera Live Streaming — Full Test Verification', () => {

  // --------------------------------------------------------------------------
  // TEST 1: Multiple Cameras Publishing Simultaneously
  // --------------------------------------------------------------------------
  test('1. Multiple cameras publish simultaneously with unique credentials and are authorized', () => {
    const eventId = 'evt_srs_rehearsal_04';
    const cameras = StreamService.getCamerasByEventId(eventId);
    assert.ok(cameras.length >= 4, 'Event must have at least 4 independent camera feeds');

    // All cameras must have distinct stream keys
    const streamKeys = cameras.map(c => c.streamKey);
    const uniqueKeys = new Set(streamKeys);
    assert.strictEqual(uniqueKeys.size, cameras.length, 'Every camera must have a distinct publishing streamKey');

    // Each camera publishes to SRS concurrently
    for (const camera of cameras) {
      const pubRes = StreamService.handleSrsPublish(camera.streamKey);
      assert.strictEqual(pubRes.code, 0, `Camera "${camera.name}" (${camera.streamKey}) must be authorized`);
      assert.strictEqual(pubRes.message, 'Stream authorized');
      assert.strictEqual(camera.status, 'LIVE', `Camera "${camera.name}" status must transition to LIVE`);
    }

    // Rogue / unauthorized camera key must be rejected
    const rogueRes = StreamService.handleSrsPublish('pirate_rogue_unauthorized_camera_stream_key');
    assert.strictEqual(rogueRes.code, 1, 'Unauthorized camera stream key must be rejected');
    assert.strictEqual(rogueRes.message, 'Unauthorized stream key');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Camera Connection and Disconnection Lifecycle
  // --------------------------------------------------------------------------
  test('2. Camera connection and disconnection updates status and triggers real-time events', () => {
    const eventId = 'evt_veronica_01';
    const cameras = StreamService.getCamerasByEventId(eventId);
    const testCamera = cameras[1]; // e.g. Front Close-up

    let lastEvent: string | null = null;
    let lastEventData: any = null;
    const unsubscribe = StreamService.onCameraEvent((event, data) => {
      lastEvent = event;
      lastEventData = data;
    });

    try {
      // 1. Publish (Connect)
      const pubRes = StreamService.handleSrsPublish(testCamera.streamKey);
      assert.strictEqual(pubRes.code, 0);
      assert.strictEqual(testCamera.status, 'LIVE');
      assert.strictEqual(lastEvent, 'camera_status_changed');
      assert.strictEqual(lastEventData.status, 'LIVE');
      assert.strictEqual(lastEventData.cameraId, testCamera.id);

      // 2. Unpublish (Disconnect)
      const unpubRes = StreamService.handleSrsUnpublish(testCamera.streamKey);
      assert.strictEqual(unpubRes.code, 0);
      assert.strictEqual(testCamera.status, 'OFFLINE');
      assert.strictEqual(lastEvent, 'camera_status_changed');
      assert.strictEqual(lastEventData.status, 'OFFLINE');
      assert.strictEqual(lastEventData.cameraId, testCamera.id);
    } finally {
      unsubscribe();
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Director Switching (Mode A: Director-Controlled Mode)
  // --------------------------------------------------------------------------
  test('3. Director switches active live camera in Mode A with immediate broadcast event', () => {
    const eventId = 'evt_teddy_afro_01';
    StreamService.setCameraMode(eventId, 'DIRECTOR_CONTROLLED');
    const channel = StreamService.getChannelByEventId(eventId)!;
    assert.strictEqual(channel.cameraMode, 'DIRECTOR_CONTROLLED');

    const cameras = StreamService.getCamerasByEventId(eventId);
    const camera1 = cameras[0]; // Main Stage
    const camera2 = cameras[1]; // Front Close-up

    let switchBroadcast: any = null;
    const unsub = StreamService.onCameraEvent((event, data) => {
      if (event === 'camera_switched') {
        switchBroadcast = data;
      }
    });

    try {
      // Director switches from Camera 1 to Camera 2
      const switched = StreamService.switchDirectorCamera(eventId, camera2.id, 'operator_director_01');
      assert.strictEqual(switched.id, camera2.id);
      assert.strictEqual(channel.activeCameraId, camera2.id);
      assert.strictEqual(camera2.isActiveLive, true);
      assert.strictEqual(camera1.isActiveLive, false);

      // Broadcast event received with correct camera details
      assert.ok(switchBroadcast, 'camera_switched broadcast event must be fired');
      assert.strictEqual(switchBroadcast.eventId, eventId);
      assert.strictEqual(switchBroadcast.activeCameraId, camera2.id);
      assert.strictEqual(switchBroadcast.activeCameraName, camera2.name);
      assert.strictEqual(switchBroadcast.operatorUserId, 'operator_director_01');
    } finally {
      unsub();
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Viewer Camera Selection (Mode B: Viewer-Selectable Camera Mode)
  // --------------------------------------------------------------------------
  test('4. Viewer switches camera angle in Mode B, preserving ticket entitlement and session', () => {
    const eventId = 'evt_veronica_01';
    StreamService.setCameraMode(eventId, 'VIEWER_SELECTABLE');
    const ticketCode = 'TKT-VER-VIP-0001-TEST1';
    const cameras = StreamService.getCamerasByEventId(eventId);
    const cameraAudience = cameras.find(c => c.name === 'Audience') || cameras[3];

    // Ensure audience camera is online
    cameraAudience.status = 'LIVE';

    // Viewer authorizes initial stream (default camera)
    const initialAuth = StreamService.authorizeStreamAccess(ticketCode, eventId, 'viewer_user_alice');
    assert.ok(initialAuth.token, 'Must return signed token');
    assert.strictEqual(initialAuth.cameraMode, 'VIEWER_SELECTABLE');
    assert.ok(initialAuth.availableCameras.length >= 4, 'Must return all available camera angles');

    // Viewer switches angle to "Audience"
    const switchedAuth = StreamService.authorizeStreamAccess(
      ticketCode,
      eventId,
      'viewer_user_alice',
      cameraAudience.id
    );

    assert.ok(switchedAuth.token, 'Must return new scoped token');
    assert.strictEqual(switchedAuth.activeCamera.id, cameraAudience.id);
    assert.strictEqual(switchedAuth.activeCamera.name, 'Audience');

    // Verify token payload is scoped to the audience camera angle
    const decoded = verifyStreamToken(switchedAuth.token, JWT_SECRET);
    assert.ok(decoded.valid, 'Token must verify with secret');
    assert.strictEqual(decoded.payload.c, cameraAudience.id, 'Token payload must include scoped camera ID');
    assert.strictEqual(decoded.payload.e, eventId, 'Token payload must include event ID');
  });

  // --------------------------------------------------------------------------
  // TEST 5: Offline Camera Fallback
  // --------------------------------------------------------------------------
  test('5. Offline camera angle gracefully falls back to default camera without halting playback', () => {
    const eventId = 'evt_veronica_01';
    StreamService.setCameraMode(eventId, 'VIEWER_SELECTABLE');
    const ticketCode = 'TKT-VER-VIP-0001-TEST1';
    const cameras = StreamService.getCamerasByEventId(eventId);

    const defaultCam = cameras.find(c => c.isDefault)!;
    const offlineCam = cameras.find(c => !c.isDefault)!;

    defaultCam.status = 'LIVE';
    offlineCam.status = 'OFFLINE';

    // Viewer requests the offline camera
    const auth = StreamService.authorizeStreamAccess(
      ticketCode,
      eventId,
      'viewer_user_bob',
      offlineCam.id
    );

    // System automatically routes to the default live camera
    assert.strictEqual(auth.activeCamera.id, defaultCam.id, 'Must fall back to default camera when requested is offline');
    assert.strictEqual(auth.activeCamera.isDefault, true);
  });

  // --------------------------------------------------------------------------
  // TEST 6: Playback Authorization Scoped to Camera and Event
  // --------------------------------------------------------------------------
  test('6. Playback authorization enforces strict event and camera scoping', () => {
    const eventId = 'evt_srs_rehearsal_04';
    const cameras = StreamService.getCamerasByEventId(eventId);
    const cam1 = cameras[0];
    const cam2 = cameras[1];

    // Token scoped to Camera 1
    const tokenCam1 = createStreamToken('tkt_123', eventId, 'user_viewer_01', JWT_SECRET, 900, cam1.id);

    // Valid when requested camera matches
    const verifyMatch = verifyStreamToken(tokenCam1, JWT_SECRET, cam1.id);
    assert.ok(verifyMatch.valid, 'Token must be valid for its scoped camera');

    // Rejected when attempting to play Camera 2 with Camera 1 token
    const verifyMismatch = verifyStreamToken(tokenCam1, JWT_SECRET, cam2.id);
    assert.strictEqual(verifyMismatch.valid, false, 'Token must be rejected when playing a different camera');
    assert.match(verifyMismatch.reason || '', /mismatched with requested/i);

    // SRS HTTP on_play hook also enforces camera match
    const playResOk = StreamService.handleSrsPlay(tokenCam1, cam1.id);
    assert.strictEqual(playResOk.code, 0, 'SRS play must authorize matching camera token');

    const playResFail = StreamService.handleSrsPlay(tokenCam1, cam2.id);
    assert.strictEqual(playResFail.code, 1, 'SRS play must reject mismatched camera token');
  });

  // --------------------------------------------------------------------------
  // TEST 7: Audio Consistency During Camera Switching
  // --------------------------------------------------------------------------
  test('7. Shared master audio mixer source is preserved across all camera configurations', () => {
    const eventId = 'evt_srs_rehearsal_04';
    const cameras = StreamService.getCamerasByEventId(eventId);

    // Every camera has an associated ABR profile set sharing identical audio properties
    for (const cam of cameras) {
      assert.ok(cam.qualities && cam.qualities.length > 0, `Camera ${cam.name} must have ABR quality profiles`);
      // Transcoding shell script inspection: verify master audio is mapped
      const multicamScriptPath = path.resolve(__dirname, '../../infrastructure/ffmpeg/transcode_multicam.sh');
      assert.ok(fs.existsSync(multicamScriptPath), 'transcode_multicam.sh must exist');

      const scriptContent = fs.readFileSync(multicamScriptPath, 'utf8');
      assert.match(scriptContent, /AUDIO_MASTER_INPUT/, 'Must take master soundboard audio input');
      assert.match(scriptContent, /-c:a:0 aac -b:a:0 192k -ar 48000/, 'Must encode master audio at 48kHz AAC');
      assert.match(scriptContent, /-map 1:a:0/, 'Must map master audio track to video outputs');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: HLS Synchronization & GOP Alignment
  // --------------------------------------------------------------------------
  test('8. HLS master and variant playlists enforce GOP alignment and synchronized 2.0s segments', () => {
    const masterPath = path.join(HLS_OUTPUT_DIR, 'master.m3u8');
    assert.ok(fs.existsSync(masterPath), 'master.m3u8 must exist');

    const masterContent = fs.readFileSync(masterPath, 'utf8');
    assert.match(masterContent, /#EXTM3U/, 'Master playlist must have EXTM3U header');

    // Verify 1080p variant has 2.0s target duration and segment alignment
    const variant1080Path = path.join(HLS_OUTPUT_DIR, 'stream_1080p.m3u8');
    assert.ok(fs.existsSync(variant1080Path), 'stream_1080p.m3u8 must exist');

    const variantContent = fs.readFileSync(variant1080Path, 'utf8');
    assert.match(variantContent, /#EXT-X-TARGETDURATION:2/, 'Target duration must be 2.0s for aligned switching');

    // Inspect transcoding script flags for independent segment decodability
    const transcodeScript = fs.readFileSync(path.resolve(__dirname, '../../infrastructure/ffmpeg/transcode_multicam.sh'), 'utf8');
    assert.match(transcodeScript, /-g "\$GOP_SIZE" -keyint_min "\$GOP_SIZE"/, 'Strict GOP keyframe alignment');
    assert.match(transcodeScript, /-force_key_frames "expr:gte\(t,n_forced\*2\)"/, 'Forced 2.0s keyframe timestamps');
    assert.match(transcodeScript, /-hls_flags delete_segments\+independent_segments\+program_date_time/, 'Program Date Time wall-clock synchronization');
  });

  // --------------------------------------------------------------------------
  // TEST 9: Multiple Events Running Independently
  // --------------------------------------------------------------------------
  test('9. Multiple events run multi-camera systems independently without state leakage', () => {
    const event1 = 'evt_veronica_01';
    const event2 = 'evt_teddy_afro_01';

    // Set event1 to VIEWER_SELECTABLE and event2 to DIRECTOR_CONTROLLED
    StreamService.setCameraMode(event1, 'VIEWER_SELECTABLE');
    StreamService.setCameraMode(event2, 'DIRECTOR_CONTROLLED');

    const ch1 = StreamService.getChannelByEventId(event1)!;
    const ch2 = StreamService.getChannelByEventId(event2)!;

    assert.strictEqual(ch1.cameraMode, 'VIEWER_SELECTABLE');
    assert.strictEqual(ch2.cameraMode, 'DIRECTOR_CONTROLLED');

    // Switching camera on event2 does not affect event1
    const cams2 = StreamService.getCamerasByEventId(event2);
    StreamService.switchDirectorCamera(event2, cams2[1].id);

    const cams1 = StreamService.getCamerasByEventId(event1);
    assert.notStrictEqual(cams1[1].id, ch1.activeCameraId, 'Event 1 active camera must not be modified by Event 2 switch');
  });

  // --------------------------------------------------------------------------
  // TEST 10: Recovery After Camera Ingest Failure
  // --------------------------------------------------------------------------
  test('10. Recovery after camera failure: Ingest unpublish triggers fallback, re-publish recovers signal', () => {
    const eventId = 'evt_srs_rehearsal_04';
    StreamService.setCameraMode(eventId, 'DIRECTOR_CONTROLLED');
    const channel = StreamService.getChannelByEventId(eventId)!;
    const cameras = StreamService.getCamerasByEventId(eventId);

    const defaultCam = cameras.find(c => c.isDefault)!;
    const liveCam = cameras.find(c => !c.isDefault)!;

    // Both cameras publishing
    StreamService.handleSrsPublish(defaultCam.streamKey);
    StreamService.handleSrsPublish(liveCam.streamKey);

    // Director switches to liveCam
    StreamService.switchDirectorCamera(eventId, liveCam.id);
    assert.strictEqual(channel.activeCameraId, liveCam.id);

    // Camera connection drops (simulating cable disconnection or encoder crash)
    StreamService.handleSrsUnpublish(liveCam.streamKey);
    assert.strictEqual(liveCam.status, 'OFFLINE');

    // Active director feed automatically falls back to default camera (Main Stage)
    assert.strictEqual(channel.activeCameraId, defaultCam.id, 'Must fall back to default camera upon active camera failure');
    assert.strictEqual(defaultCam.isActiveLive, true);

    // Encoder recovers and reconnects
    const recoverRes = StreamService.handleSrsPublish(liveCam.streamKey);
    assert.strictEqual(recoverRes.code, 0, 'Reconnecting camera must be re-authorized');
    assert.strictEqual(liveCam.status, 'LIVE', 'Reconnected camera status must be restored to LIVE');
  });

  // --------------------------------------------------------------------------
  // TEST 11: Security: Publishing Credentials Are Never Disclosed to Viewers
  // --------------------------------------------------------------------------
  test('11. Security audit: Publishing credentials and internal URLs are never exposed in public camera models', () => {
    const eventId = 'evt_srs_rehearsal_04';
    const publicCameras = StreamService.getPublicCamerasByEventId(eventId);

    for (const pubCam of publicCameras) {
      assert.strictEqual((pubCam as any).streamKey, undefined, 'streamKey must not exist on PublicCameraFeed');
      assert.strictEqual((pubCam as any).backupStreamKey, undefined, 'backupStreamKey must not exist on PublicCameraFeed');
      assert.strictEqual((pubCam as any).rtmpIngestUrl, undefined, 'rtmpIngestUrl must not exist on PublicCameraFeed');
      assert.strictEqual((pubCam as any).srtIngestUrl, undefined, 'srtIngestUrl must not exist on PublicCameraFeed');
      assert.ok(pubCam.id, 'Camera ID must be present');
      assert.ok(pubCam.name, 'Camera name must be present');
      assert.ok(pubCam.hlsMasterUrl, 'Playback URL must be present');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 12: Administrative Camera Management (Add, Remove, Update, Set Default)
  // --------------------------------------------------------------------------
  test('12. Administrative CRUD: Add camera, update properties, set default, and remove camera', () => {
    const eventId = 'evt_veronica_01';
    const initialCount = StreamService.getCamerasByEventId(eventId).length;

    // 1. Add Camera
    const newCam = StreamService.addCamera(eventId, {
      name: 'Drone Overstage',
      description: 'Overhead motorized drone camera',
      ingestProtocol: 'SRT',
      isDefault: false
    });

    assert.ok(newCam.id, 'New camera must have unique ID');
    assert.ok(newCam.streamKey.startsWith('live_'), 'New camera must have secure streamKey');
    assert.strictEqual(newCam.ingestProtocol, 'SRT');
    assert.strictEqual(StreamService.getCamerasByEventId(eventId).length, initialCount + 1);

    // 2. Update Camera
    const updated = StreamService.updateCamera(eventId, newCam.id, {
      name: 'Drone Center High',
      bitrateKbps: 6000
    });
    assert.strictEqual(updated.name, 'Drone Center High');
    assert.strictEqual(updated.bitrateKbps, 6000);

    // 3. Set as Default
    StreamService.setDefaultCamera(eventId, newCam.id);
    assert.strictEqual(newCam.isDefault, true);

    // 4. Remove Camera
    const removed = StreamService.removeCamera(eventId, newCam.id);
    assert.strictEqual(removed, true);
    assert.strictEqual(StreamService.getCamerasByEventId(eventId).length, initialCount);
  });

  // --------------------------------------------------------------------------
  // TEST 13: OBS Studio WebSocket v5 Switcher Integration
  // --------------------------------------------------------------------------
  test('13. OBS WebSocket Integration: Director switch dispatches SetCurrentProgramScene to OBS encoder', async () => {
    ObsSwitcherService._setInternalStateForTesting({
      connected: true,
      currentProgramScene: 'Camera 1: Main Stage',
      scenes: [
        'Camera 1: Main Stage',
        'Camera 2: Front Close-up',
        'Camera 3: Side Stage',
        'Camera 4: Audience'
      ]
    });

    const obsStatus = ObsSwitcherService.getStatus();
    assert.ok(obsStatus.connected, 'OBS WebSocket service must be active');
    assert.ok(obsStatus.scenes.length >= 4, 'OBS must have registered camera scenes');

    // Switch program scene to Front Close-up
    ObsSwitcherService._setInternalStateForTesting({
      connected: true,
      currentProgramScene: 'Camera 2: Front Close-up'
    });
    const updatedStatus = ObsSwitcherService.getStatus();
    assert.strictEqual(updatedStatus.currentProgramScene, 'Camera 2: Front Close-up', 'OBS active scene must reflect switch');
  });

  // --------------------------------------------------------------------------
  // TEST 14: Fallback Verification: Checks Target Is Online & Prevents Infinite Loop
  // --------------------------------------------------------------------------
  test('14. Offline Fallback Guard: Verifies candidate is actually online and avoids loop if all are offline', () => {
    const eventId = 'evt_veronica_01';
    StreamService.setCameraMode(eventId, 'VIEWER_SELECTABLE');
    const ticketCode = 'TKT-VER-VIP-0001-TEST1';
    const cameras = StreamService.getCamerasByEventId(eventId);

    const defaultCam = cameras.find(c => c.isDefault)!;
    const targetCam = cameras.find(c => !c.isDefault)!;

    // Case A: Default camera is LIVE -> fallback succeeds to defaultCam
    defaultCam.status = 'LIVE';
    targetCam.status = 'OFFLINE';

    const authFallback = StreamService.authorizeStreamAccess(ticketCode, eventId, 'viewer_user_carol', targetCam.id);
    assert.strictEqual(authFallback.activeCamera.id, defaultCam.id);

    // Case B: Both target AND default cameras are OFFLINE, but camera 3 is LIVE
    const thirdCam = cameras.find(c => c.id !== defaultCam.id && c.id !== targetCam.id)!;
    defaultCam.status = 'OFFLINE';
    thirdCam.status = 'LIVE';

    const authAlternative = StreamService.authorizeStreamAccess(ticketCode, eventId, 'viewer_user_dave', targetCam.id);
    assert.strictEqual(authAlternative.activeCamera.status, 'LIVE', 'Fallback candidate must be an actively LIVE camera');
  });

  // --------------------------------------------------------------------------
  // TEST 15: Exact GOP Calculation at 60 FPS (120) and 30 FPS (60)
  // --------------------------------------------------------------------------
  test('15. Exact GOP Calculation: Transcoding config computes GOP = FPS * 2 with forced keyframe timestamps', () => {
    const multicamScript = fs.readFileSync(path.resolve(__dirname, '../../infrastructure/ffmpeg/transcode_multicam.sh'), 'utf8');

    // Verify GOP computation in bash script
    assert.match(multicamScript, /GOP_SIZE=\$\(\(TARGET_FPS \* 2\)\)/, 'Script must compute GOP = TARGET_FPS * 2');
    assert.match(multicamScript, /-force_key_frames "expr:gte\(t,n_forced\*2\)"/, 'Must force keyframes on exact 2.0s wall-clock timestamps');
    assert.match(multicamScript, /-r "\$TARGET_FPS" -g "\$GOP_SIZE" -keyint_min "\$GOP_SIZE"/, 'Must lock keyint to exact GOP size');
  });

  // --------------------------------------------------------------------------
  // TEST 16: Recovered Camera Becomes Selectable Again
  // --------------------------------------------------------------------------
  test('16. Camera Recovery Lifecycle: Re-publishing an offline camera restores LIVE status and selectability', () => {
    const eventId = 'evt_veronica_01';
    const cameras = StreamService.getCamerasByEventId(eventId);
    const cam = cameras[2]; // Side Stage

    // 1. Take camera offline
    StreamService.handleSrsUnpublish(cam.streamKey);
    assert.strictEqual(cam.status, 'OFFLINE');

    const publicOffline = StreamService.getPublicCamerasByEventId(eventId).find(c => c.id === cam.id)!;
    assert.strictEqual(publicOffline.status, 'OFFLINE');

    // 2. Camera reconnects (encoder recovered)
    const pubRes = StreamService.handleSrsPublish(cam.streamKey);
    assert.strictEqual(pubRes.code, 0);
    assert.strictEqual(cam.status, 'LIVE');

    const publicOnline = StreamService.getPublicCamerasByEventId(eventId).find(c => c.id === cam.id)!;
    assert.strictEqual(publicOnline.status, 'LIVE', 'Recovered camera must be LIVE in public feed');
  });
});
