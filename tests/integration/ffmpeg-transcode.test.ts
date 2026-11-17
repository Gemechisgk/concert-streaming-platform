import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { FfmpegSupervisorService } from '../../packages/business-logic/src/ffmpeg-supervisor.service';

const TEST_OUTPUT_DIR = path.resolve(__dirname, '../../objs/test_transcode_multicam');

/**
 * Real FFmpeg Multi-Camera ABR Transcoding Test
 *
 * Spawns the actual FFmpeg binary, executes an ABR transcoding job
 * with 4 tiers (1080p, 720p, 480p, 360p), enforces 2.0s GOP alignment,
 * and inspects generated playlists and TS segments on disk.
 */
describe('FFmpeg Multi-Camera ABR Transcoding & HLS Playlist Inspection', () => {
  before(() => {
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
  });

  after(async () => {
    await FfmpegSupervisorService.stopAll();
    // Keep test directory or cleanup
  });

  test('1. Executes real FFmpeg job producing 4 ABR tiers with 2.0s GOP alignment', async () => {
    const cameraId = 'cam_stage_real_test';
    const cameraOutputDir = path.join(TEST_OUTPUT_DIR, cameraId);

    // Launch real 4-tier transcode job with 30 FPS -> 60 GOP (2.0s interval)
    // Run for 5 seconds to generate at least two 2.0s segments
    const jobStatus = await FfmpegSupervisorService.startCameraTranscode({
      cameraId,
      cameraName: 'Main Stage Real Test',
      videoInputUrl: '',
      masterAudioInputUrl: '',
      outputDirectory: cameraOutputDir,
      targetFps: 30,
      useTestPattern: true,
      durationSeconds: 5
    });

    assert.ok(jobStatus.running, 'FFmpeg process must be running');
    assert.ok(jobStatus.pid, 'Process must have a valid system PID');
    assert.strictEqual(jobStatus.targetFps, 30);
    assert.strictEqual(jobStatus.gopSize, 60, 'GOP size must strictly equal FPS * 2 (60 frames)');

    // Poll until FFmpeg completes or generates initial HLS segments (max 15s)
    let masterExists = false;
    let stream1080pExists = false;
    let stream720pExists = false;
    let stream480pExists = false;
    let stream360pExists = false;

    const masterPath = path.join(cameraOutputDir, 'master.m3u8');
    const pl1080pPath = path.join(cameraOutputDir, 'stream_1080p.m3u8');
    const pl720pPath = path.join(cameraOutputDir, 'stream_720p.m3u8');
    const pl480pPath = path.join(cameraOutputDir, 'stream_480p.m3u8');
    const pl360pPath = path.join(cameraOutputDir, 'stream_360p.m3u8');

    const startTime = Date.now();
    while (Date.now() - startTime < 15000) {
      if (fs.existsSync(masterPath)) masterExists = true;
      if (fs.existsSync(pl1080pPath)) stream1080pExists = true;
      if (fs.existsSync(pl720pPath)) stream720pExists = true;
      if (fs.existsSync(pl480pPath)) stream480pExists = true;
      if (fs.existsSync(pl360pPath)) stream360pExists = true;

      if (masterExists && stream1080pExists && stream720pExists && stream480pExists && stream360pExists) {
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }

    assert.ok(masterExists, 'master.m3u8 must be generated on disk by FFmpeg');
    assert.ok(stream1080pExists, 'stream_1080p.m3u8 must exist');
    assert.ok(stream720pExists, 'stream_720p.m3u8 must exist');
    assert.ok(stream480pExists, 'stream_480p.m3u8 must exist');
    assert.ok(stream360pExists, 'stream_360p.m3u8 must exist');

    // 2. Inspect master.m3u8 playlist structure
    const masterContent = fs.readFileSync(masterPath, 'utf-8');
    assert.ok(masterContent.includes('#EXTM3U'), 'Master playlist must start with #EXTM3U');
    assert.ok(masterContent.includes('BANDWIDTH=4500000') || masterContent.includes('RESOLUTION=1920x1080'), 'Must contain 1080p stream definition');
    assert.ok(masterContent.includes('RESOLUTION=1280x720'), 'Must contain 720p stream definition');
    assert.ok(masterContent.includes('RESOLUTION=854x480'), 'Must contain 480p stream definition');
    assert.ok(masterContent.includes('RESOLUTION=640x360'), 'Must contain 360p stream definition');

    // 3. Inspect variant playlist and verify exact 2.0s target duration
    const pl1080pContent = fs.readFileSync(pl1080pPath, 'utf-8');
    assert.ok(pl1080pContent.includes('#EXT-X-TARGETDURATION:2'), 'Variant playlist must enforce 2.0s target duration');
    assert.ok(pl1080pContent.includes('#EXT-X-PROGRAM-DATE-TIME'), 'Must include wall-clock synchronization tags');

    // 4. Verify actual TS segment media files exist on disk with non-zero bytes
    const files = fs.readdirSync(cameraOutputDir);
    const tsFiles = files.filter(f => f.endsWith('.ts'));
    assert.ok(tsFiles.length >= 1, `Must have generated actual .ts media segments (found ${tsFiles.length})`);

    const firstSegment = path.join(cameraOutputDir, tsFiles[0]);
    const stat = fs.statSync(firstSegment);
    assert.ok(stat.size > 10000, `TS segment must contain real encoded media data (size: ${stat.size} bytes)`);

    // 5. Clean process termination
    await FfmpegSupervisorService.stopCameraTranscode(cameraId);
    const postStopStatus = FfmpegSupervisorService.getJobStatus(cameraId);
    assert.strictEqual(postStopStatus, null, 'Job must be removed upon stopping');
  });
});
