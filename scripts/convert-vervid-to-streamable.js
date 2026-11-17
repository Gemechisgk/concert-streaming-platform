/**
 * Convert vervid.mp4 to Production HLS Adaptive Bitrate (ABR) Stream Package
 *
 * Transcodes vervid.mp4 into 4 synchronized ABR tiers (1080p, 720p, 480p, 360p)
 * with strict 2.0s GOP alignment and generates master.m3u8.
 * Also generates web-optimized faststart MP4 (vervid_streamable.mp4).
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const INPUT_VIDEO = path.join(ROOT_DIR, 'apps/web/public/vervid.mp4');
const PRIMARY_HLS_DIR = path.join(
  ROOT_DIR,
  'infrastructure/srs/windows/SRS-Windows-x86_64-8.0-d3/objs/nginx/html/live/abr'
);
const PUBLIC_HLS_DIR = path.join(ROOT_DIR, 'apps/web/public/live/abr');
const FASTSTART_OUTPUT = path.join(ROOT_DIR, 'apps/web/public/vervid_streamable.mp4');

console.log('=== FESHTA FEST LIVE STREAMING ENCODER ===');
console.log('Input Video:', INPUT_VIDEO);
if (!fs.existsSync(INPUT_VIDEO)) {
  console.error('Error: Input video not found at:', INPUT_VIDEO);
  process.exit(1);
}

// Ensure target directories exist
fs.mkdirSync(PRIMARY_HLS_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_HLS_DIR, { recursive: true });

// Step 1: Web-Optimized Faststart MP4 (-c copy -movflags +faststart)
console.log('\n[1/3] Generating FastStart streamable MP4...');
const faststartRes = spawnSync(
  'ffmpeg',
  ['-y', '-i', INPUT_VIDEO, '-c', 'copy', '-movflags', '+faststart', FASTSTART_OUTPUT],
  { stdio: 'inherit' }
);
if (faststartRes.status === 0) {
  console.log('✓ FastStart MP4 created at:', FASTSTART_OUTPUT);
} else {
  console.warn('Faststart copy warning, exit code:', faststartRes.status);
}

// Step 2: 4-Tier Adaptive Bitrate (ABR) HLS Encoding
// Source is 25 fps, so GOP = 50 frames for exact 2.0s segments
console.log('\n[2/3] Transcoding vervid.mp4 into 4-tier ABR HLS (1080p, 720p, 480p, 360p)...');
const TARGET_FPS = 25;
const GOP_SIZE = 50; // 2.0s * 25fps

const ffmpegArgs = [
  '-y',
  '-i', INPUT_VIDEO,
  '-filter_complex',
  '[0:v]split=4[v1][v2][v3][v4]; ' +
  '[v1]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v1out]; ' +
  '[v2]scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v2out]; ' +
  '[v3]scale=w=854:h=480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2[v3out]; ' +
  '[v4]scale=w=640:h=360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2[v4out]',
  // 1080p Profile
  '-map', '[v1out]',
  '-c:v:0', 'libx264',
  '-preset', 'veryfast',
  '-b:v:0', '3500k',
  '-maxrate:v:0', '4000k',
  '-bufsize:v:0', '7000k',
  '-r', String(TARGET_FPS),
  '-g', String(GOP_SIZE),
  '-keyint_min', String(GOP_SIZE),
  '-sc_threshold', '0',
  // 720p Profile
  '-map', '[v2out]',
  '-c:v:1', 'libx264',
  '-preset', 'veryfast',
  '-b:v:1', '2200k',
  '-maxrate:v:1', '2500k',
  '-bufsize:v:1', '4500k',
  '-r', String(TARGET_FPS),
  '-g', String(GOP_SIZE),
  '-keyint_min', String(GOP_SIZE),
  '-sc_threshold', '0',
  // 480p Profile
  '-map', '[v3out]',
  '-c:v:2', 'libx264',
  '-preset', 'veryfast',
  '-b:v:2', '1000k',
  '-maxrate:v:2', '1200k',
  '-bufsize:v:2', '2000k',
  '-r', String(TARGET_FPS),
  '-g', String(GOP_SIZE),
  '-keyint_min', String(GOP_SIZE),
  '-sc_threshold', '0',
  // 360p Profile
  '-map', '[v4out]',
  '-c:v:3', 'libx264',
  '-preset', 'veryfast',
  '-b:v:3', '600k',
  '-maxrate:v:3', '700k',
  '-bufsize:v:3', '1200k',
  '-r', String(TARGET_FPS),
  '-g', String(GOP_SIZE),
  '-keyint_min', String(GOP_SIZE),
  '-sc_threshold', '0',
  // Audio streams mapped to each variant
  '-map', '0:a:0',
  '-c:a:0', 'aac',
  '-b:a:0', '192k',
  '-ar', '48000',
  '-map', '0:a:0',
  '-c:a:1', 'aac',
  '-b:a:1', '128k',
  '-ar', '48000',
  '-map', '0:a:0',
  '-c:a:2', 'aac',
  '-b:a:2', '96k',
  '-ar', '48000',
  '-map', '0:a:0',
  '-c:a:3', 'aac',
  '-b:a:3', '64k',
  '-ar', '48000',
  // HLS Multi-Variant Muxer
  '-f', 'hls',
  '-hls_time', '2',
  '-hls_playlist_type', 'event',
  '-hls_flags', 'independent_segments+program_date_time',
  '-master_pl_name', 'master.m3u8',
  '-var_stream_map', 'v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p v:3,a:3,name:360p',
  '-hls_segment_filename', path.join(PRIMARY_HLS_DIR, 'stream_%v%d.ts'),
  path.join(PRIMARY_HLS_DIR, 'stream_%v.m3u8')
];

const hlsRes = spawnSync('ffmpeg', ffmpegArgs, { stdio: 'inherit' });
if (hlsRes.status !== 0) {
  console.error('Error during FFmpeg HLS transcoding. Status:', hlsRes.status);
  process.exit(1);
}

// Step 3: Mirror HLS package to public directory for direct fallback serving
console.log('\n[3/3] Mirroring HLS files to public CDN cache directory...');
const generatedFiles = fs.readdirSync(PRIMARY_HLS_DIR);
let count = 0;
for (const file of generatedFiles) {
  const src = path.join(PRIMARY_HLS_DIR, file);
  const dest = path.join(PUBLIC_HLS_DIR, file);
  fs.copyFileSync(src, dest);
  count++;
}
console.log(`✓ Successfully mirrored ${count} HLS files to ${PUBLIC_HLS_DIR}`);

console.log('\n=== TRANSCODING COMPLETE ===');
console.log('Master HLS Playlist:');
console.log(fs.readFileSync(path.join(PRIMARY_HLS_DIR, 'master.m3u8'), 'utf8'));
