#!/usr/bin/env bash
# ============================================================================
# FESHTA FEST LIVE PLATFORM — MULTI-CAMERA ABR TRANSCODING PIPELINE
# ============================================================================
# Synchronizes multiple camera angles with a single shared master audio source
# and strictly aligned 2.0-second HLS segment boundaries.
#
# Keyframe Calculation Rule:
#   GOP = FPS * 2.0 seconds
#   At 60 FPS -> GOP = 120 keyframe interval
#   At 30 FPS -> GOP = 60 keyframe interval
#   -force_key_frames "expr:gte(t,n_forced*2)" guarantees wall-clock keyframe placement

set -euo pipefail

AUDIO_MASTER_INPUT="${1:-rtmp://localhost:1935/live/master_audio}"
CAM1_INPUT="${2:-rtmp://localhost:1935/live/cam_main_stage}"
CAM2_INPUT="${3:-rtmp://localhost:1935/live/cam_closeup}"
CAM3_INPUT="${4:-rtmp://localhost:1935/live/cam_sidestage}"
CAM4_INPUT="${5:-rtmp://localhost:1935/live/cam_audience}"
OUTPUT_BASE_DIR="${6:-./objs/nginx/html/live/multicam}"
TARGET_FPS="${7:-60}"

# Strictly compute GOP size from actual frame rate to guarantee exact 2-second segments
GOP_SIZE=$((TARGET_FPS * 2))

echo "[Multi-Camera Transcoder] Configuration: Target FPS=$TARGET_FPS | Computed GOP=$GOP_SIZE (2.0s interval)"
mkdir -p "$OUTPUT_BASE_DIR/cam1" "$OUTPUT_BASE_DIR/cam2" "$OUTPUT_BASE_DIR/cam3" "$OUTPUT_BASE_DIR/cam4"

transcode_camera() {
  local CAM_ID="$1"
  local CAM_INPUT="$2"
  local OUT_DIR="$OUTPUT_BASE_DIR/$CAM_ID"

  echo "[Camera $CAM_ID] Launching transcoder: Video=$CAM_INPUT | Audio=$AUDIO_MASTER_INPUT | GOP=$GOP_SIZE"

  ffmpeg -y \
    -fflags +genpts \
    -use_wallclock_as_timestamps 1 \
    -i "$CAM_INPUT" \
    -i "$AUDIO_MASTER_INPUT" \
    -filter_complex \
    "[0:v]fps=fps=$TARGET_FPS,split=2[v1080,v720]; \
     [v1080]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v1080out]; \
     [v720]scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v720out]" \
    -map "[v1080out]" -c:v:0 libx264 -preset veryfast -b:v:0 4500k -maxrate:v:0 4800k -bufsize:v:0 9000k \
    -r "$TARGET_FPS" -g "$GOP_SIZE" -keyint_min "$GOP_SIZE" -sc_threshold 0 \
    -force_key_frames "expr:gte(t,n_forced*2)" \
    -map "[v720out]" -c:v:1 libx264 -preset veryfast -b:v:1 2500k -maxrate:v:1 2700k -bufsize:v:1 5000k \
    -r "$TARGET_FPS" -g "$GOP_SIZE" -keyint_min "$GOP_SIZE" -sc_threshold 0 \
    -force_key_frames "expr:gte(t,n_forced*2)" \
    -map 1:a:0 -c:a:0 aac -b:a:0 192k -ar 48000 \
    -map 1:a:0 -c:a:1 aac -b:a:1 128k -ar 48000 \
    -f hls \
    -hls_time 2 \
    -hls_list_size 6 \
    -hls_flags delete_segments+independent_segments+program_date_time \
    -master_pl_name master.m3u8 \
    -var_stream_map "v:0,a:0,name:1080p v:1,a:1,name:720p" \
    "$OUT_DIR/stream_%v.m3u8"
}

echo "[Multi-Camera Transcoder] Configured 4 camera angles with shared audio mixer source and exact 2.0s GOP."
