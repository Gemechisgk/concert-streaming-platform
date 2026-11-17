/**
 * Simple conversion: Generate web-optimized streamable MP4 and HLS for Feshta Fest
 * Uses local temp directory to avoid disk space issues
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const INPUT_VIDEO = path.join(ROOT_DIR, 'apps/web/public/vervid.mp4');
const TEMP_DIR = path.join(ROOT_DIR, 'temp_hls');
const OUTPUT_DIR = path.join(ROOT_DIR, 'apps/web/public/live/abr');

console.log('=== FESHTA FEST VERVID STREAMING CONVERSION ===');
console.log('Input:', INPUT_VIDEO);

// Verify input exists
if (!fs.existsSync(INPUT_VIDEO)) {
  console.error('Error: Input video not found:', INPUT_VIDEO);
  process.exit(1);
}

// Ensure output directory exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

// Clean temp directory
if (fs.existsSync(TEMP_DIR)) {
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });
}
fs.mkdirSync(TEMP_DIR, { recursive: true });

console.log('\nStep 1: Generating web-optimized MP4...');
const faststartRes = spawnSync(
  'ffmpeg',
  ['-y', '-i', INPUT_VIDEO, '-c', 'copy', '-movflags', '+faststart', path.join(OUTPUT_DIR, 'vervid_streamable.mp4')],
  { stdio: 'inherit' }
);

if (faststartRes.status === 0) {
  console.log('✓ FastStart MP4 created');
} else {
  console.error('FastStart conversion failed:', faststartRes.status);
}

console.log('\nStep 2: Generating HLS 4-tier ABR...');

// Use valid H.264 dimensions (must be divisible by 2)
// Using fixed scale filter for cleaner output
const hlsArgs = [
  '-y',
  '-i', INPUT_VIDEO,
  // Scale to valid dimensions
  '-filter_complex',
  '[0:v]split=4[v1080][v720][v480][v360];' +
  '[v1080]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v1080out];' +
  '[v720]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v720out];' +
  '[v480]scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2,crop=854:480[v480out];' +
  '[v360]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2[v360out]',
  
  // 1080p - valid dimensions
  '-map', '[v1080out]', '-c:v:0', 'libx264', '-preset', 'fast', '-b:v:0', '4500k', '-g', '50', '-keyint_min', '50',
  '-map', 'a:0', '-c:a:0', 'aac', '-b:a:0', '192k',
  '-f', 'hls', '-hls_time', '4', '-hls_segment_filename', path.join(TEMP_DIR, '1080p_%03d.ts'),
  path.join(TEMP_DIR, '1080p.m3u8'),
  
  // 720p - valid dimensions
  '-map', '[v720out]', '-c:v:1', 'libx264', '-preset', 'fast', '-b:v:1', '2500k', '-g', '50', '-keyint_min', '50',
  '-map', 'a:0', '-c:a:1', 'aac', '-b:a:1', '128k',
  '-f', 'hls', '-hls_time', '4', '-hls_segment_filename', path.join(TEMP_DIR, '720p_%03d.ts'),
  path.join(TEMP_DIR, '720p.m3u8'),
  
  // 480p - 854x480 needs cropping to be valid
  '-map', '[v480out]', '-c:v:2', 'libx264', '-preset', 'fast', '-b:v:2', '1000k', '-g', '50', '-keyint_min', '50',
  '-map', 'a:0', '-c:a:2', 'aac', '-b:a:2', '96k',
  '-f', 'hls', '-hls_time', '4', '-hls_segment_filename', path.join(TEMP_DIR, '480p_%03d.ts'),
  path.join(TEMP_DIR, '480p.m3u8'),
  
  // 360p - valid dimensions
  '-map', '[v360out]', '-c:v:3', 'libx264', '-preset', 'fast', '-b:v:3', '600k', '-g', '50', '-keyint_min', '50',
  '-map', 'a:0', '-c:a:3', 'aac', '-b:a:3', '64k',
  '-f', 'hls', '-hls_time', '4', '-hls_segment_filename', path.join(TEMP_DIR, '360p_%03d.ts'),
  path.join(TEMP_DIR, '360p.m3u8')
];

const hlsRes = spawnSync('ffmpeg', hlsArgs, { stdio: 'inherit' });

if (hlsRes.status !== 0) {
  console.error('HLS encoding failed with exit code:', hlsRes.status);
  process.exit(1);
}

console.log('\nStep 3: Creating master.m3u8 playlist...');
const masterPlaylist = `#EXTM3U
#EXT-X-VERSION:4
#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080,NAME="1080p"
1080p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720,NAME="720p"
720p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=854x480,NAME="480p"
480p.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=600000,RESOLUTION=640x360,NAME="360p"
360p.m3u8
`;

fs.writeFileSync(path.join(TEMP_DIR, 'master.m3u8'), masterPlaylist);

console.log('\nStep 4: Copying HLS files to public directory...');
const hlsFiles = fs.readdirSync(TEMP_DIR);
for (const file of hlsFiles) {
  const src = path.join(TEMP_DIR, file);
  const dest = path.join(OUTPUT_DIR, file);
  fs.copyFileSync(src, dest);
}
console.log(`✓ Copied ${hlsFiles.length} HLS files to ${OUTPUT_DIR}`);

// Cleanup temp directory
fs.rmSync(TEMP_DIR, { recursive: true, force: true });
console.log('✓ Cleaned up temporary files');

console.log('\n=== CONVERSION COMPLETE ===');
console.log('\nMaster Playlist:');
console.log(masterPlaylist);
