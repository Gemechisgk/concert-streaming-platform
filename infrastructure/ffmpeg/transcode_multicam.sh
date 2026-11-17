#!/usr/bin/env bash
# ============================================================================
# FESHTA FEST LIVE PLATFORM — MULTI-CAMERA ABR TRANSCODING PIPELINE & SUPERVISOR
# ============================================================================
# Synchronizes multiple camera angles with a single shared master audio source
# and strictly aligned 2.0-second HLS segment boundaries.
#
# Produces 4 ABR tiers for each camera:
#   - 1080p (4500 kbps video + 192 kbps audio)
#   - 720p  (2500 kbps video + 128 kbps audio)
#   - 480p  (1000 kbps video + 96 kbps audio)
#   - 360p  (600 kbps video  + 64 kbps audio)
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
DURATION="${DURATION:-0}" # 0 = infinite live stream, >0 = bounded test duration
MODE="${MODE:-live}"      # 'live' or 'test' (test uses lavfi synthetic patterns)

# Strictly compute GOP size from actual frame rate to guarantee exact 2-second segments
GOP_SIZE=$((TARGET_FPS * 2))

echo "[Multi-Camera Transcoder] Configuration: Target FPS=$TARGET_FPS | Computed GOP=$GOP_SIZE (2.0s interval)"
mkdir -p "$OUTPUT_BASE_DIR/cam1" "$OUTPUT_BASE_DIR/cam2" "$OUTPUT_BASE_DIR/cam3" "$OUTPUT_BASE_DIR/cam4"

# Associative maps / arrays for process supervision
declare -A CAM_PIDS
declare -A CAM_RESTARTS
MAX_RESTARTS=3

cleanup() {
  echo ""
  echo "[Multi-Camera Supervisor] Signal received. Terminating all camera transcoding processes..."
  trap - SIGINT SIGTERM EXIT
  for cam in "${!CAM_PIDS[@]}"; do
    local pid="${CAM_PIDS[$cam]}"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "[Multi-Camera Supervisor] Stopping Camera $cam (PID $pid)..."
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
  echo "[Multi-Camera Supervisor] All camera transcoding pipelines cleanly stopped."
}

trap cleanup SIGINT SIGTERM EXIT

transcode_camera() {
  local CAM_ID="$1"
  local CAM_INPUT="$2"
  local OUT_DIR="$OUTPUT_BASE_DIR/$CAM_ID"
  local DURATION_FLAG=""

  if [ "$DURATION" -gt 0 ]; then
    DURATION_FLAG="-t $DURATION"
  fi

  echo "[Camera $CAM_ID] Launching 4-tier ABR transcoder (1080p, 720p, 480p, 360p): Video=$CAM_INPUT | Audio=$AUDIO_MASTER_INPUT | GOP=$GOP_SIZE"

  if [ "$MODE" = "test" ]; then
    # Test mode: generate synthetic 1080p test pattern and 48kHz audio tone
    ffmpeg -y \
      -f lavfi -i "testsrc=size=1920x1080:rate=$TARGET_FPS" \
      -f lavfi -i "sine=frequency=1000:sample_rate=48000" \
      $DURATION_FLAG \
      -filter_complex \
      "[0:v]fps=fps=$TARGET_FPS,split=4[v1][v2][v3][v4]; \
       [v1]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v1out]; \
       [v2]scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v2out]; \
       [v3]scale=w=854:h=480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2[v3out]; \
       [v4]scale=w=640:h=360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2[v4out]" \
      -map "[v1out]" -c:v:0 libx264 -preset veryfast -b:v:0 4500k -maxrate:v:0 4800k -bufsize:v:0 9000k \
      -r "$TARGET_FPS" -g "$GOP_SIZE" -keyint_min "$GOP_SIZE" -sc_threshold 0 \
      -force_key_frames "expr:gte(t,n_forced*2)" \
      -map "[v2out]" -c:v:1 libx264 -preset veryfast -b:v:1 2500k -maxrate:v:1 2700k -bufsize:v:1 5000k \
      -r "$TARGET_FPS" -g "$GOP_SIZE" -keyint_min "$GOP_SIZE" -sc_threshold 0 \
      -force_key_frames "expr:gte(t,n_forced*2)" \
      -map "[v3out]" -c:v:2 libx264 -preset veryfast -b:v:2 1000k -maxrate:v:2 1100k -bufsize:v:2 2000k \
      -r "$TARGET_FPS" -g "$GOP_SIZE" -keyint_min "$GOP_SIZE" -sc_threshold 0 \
      -force_key_frames "expr:gte(t,n_forced*2)" \
      -map "[v4out]" -c:v:3 libx264 -preset veryfast -b:v:3 600k -maxrate:v:3 700k -bufsize:v:3 1200k \
      -r "$TARGET_FPS" -g "$GOP_SIZE" -keyint_min "$GOP_SIZE" -sc_threshold 0 \
      -force_key_frames "expr:gte(t,n_forced*2)" \
      -map 1:a:0 -c:a:0 aac -b:a:0 192k -ar 48000 \
      -map 1:a:0 -c:a:1 aac -b:a:1 128k -ar 48000 \
      -map 1:a:0 -c:a:2 aac -b:a:2 96k -ar 48000 \
      -map 1:a:0 -c:a:3 aac -b:a:3 64k -ar 48000 \
      -f hls \
      -hls_time 2 \
      -hls_list_size 6 \
      -hls_flags delete_segments+independent_segments+program_date_time \
      -master_pl_name master.m3u8 \
      -var_stream_map "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p v:3,a:3,name:360p" \
      "$OUT_DIR/stream_%v.m3u8"
  else
    # Live production mode: ingest physical RTMP/SRT stream and master audio bus
    ffmpeg -y \
      -fflags +genpts \
      -use_wallclock_as_timestamps 1 \
      -i "$CAM_INPUT" \
      -i "$AUDIO_MASTER_INPUT" \
      $DURATION_FLAG \
      -filter_complex \
      "[0:v]fps=fps=$TARGET_FPS,split=4[v1][v2][v3][v4]; \
       [v1]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v1out]; \
       [v2]scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v2out]; \
       [v3]scale=w=854:h=480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2[v3out]; \
       [v4]scale=w=640:h=360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2[v4out]" \
      -map "[v1out]" -c:v:0 libx264 -preset veryfast -b:v:0 4500k -maxrate:v:0 4800k -bufsize:v:0 9000k \
      -r "$TARGET_FPS" -g "$GOP_SIZE" -keyint_min "$GOP_SIZE" -sc_threshold 0 \
      -force_key_frames "expr:gte(t,n_forced*2)" \
      -map "[v2out]" -c:v:1 libx264 -preset veryfast -b:v:1 2500k -maxrate:v:1 2700k -bufsize:v:1 5000k \
      -r "$TARGET_FPS" -g "$GOP_SIZE" -keyint_min "$GOP_SIZE" -sc_threshold 0 \
      -force_key_frames "expr:gte(t,n_forced*2)" \
      -map "[v3out]" -c:v:2 libx264 -preset veryfast -b:v:2 1000k -maxrate:v:2 1100k -bufsize:v:2 2000k \
      -r "$TARGET_FPS" -g "$GOP_SIZE" -keyint_min "$GOP_SIZE" -sc_threshold 0 \
      -force_key_frames "expr:gte(t,n_forced*2)" \
      -map "[v4out]" -c:v:3 libx264 -preset veryfast -b:v:3 600k -maxrate:v:3 700k -bufsize:v:3 1200k \
      -r "$TARGET_FPS" -g "$GOP_SIZE" -keyint_min "$GOP_SIZE" -sc_threshold 0 \
      -force_key_frames "expr:gte(t,n_forced*2)" \
      -map 1:a:0 -c:a:0 aac -b:a:0 192k -ar 48000 \
      -map 1:a:0 -c:a:1 aac -b:a:1 128k -ar 48000 \
      -map 1:a:0 -c:a:2 aac -b:a:2 96k -ar 48000 \
      -map 1:a:0 -c:a:3 aac -b:a:3 64k -ar 48000 \
      -f hls \
      -hls_time 2 \
      -hls_list_size 6 \
      -hls_flags delete_segments+independent_segments+program_date_time \
      -master_pl_name master.m3u8 \
      -var_stream_map "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p v:3,a:3,name:360p" \
      "$OUT_DIR/stream_%v.m3u8"
  fi
}

start_camera() {
  local cam="$1"
  local input="$2"
  transcode_camera "$cam" "$input" &
  local pid=$!
  CAM_PIDS["$cam"]=$pid
  echo "[Multi-Camera Supervisor] Started $cam on PID $pid"
}

# ----------------------------------------------------------------------------
# 1. Launch Transcoding for Every Configured Camera Angle
# ----------------------------------------------------------------------------
CAMERAS=("cam1" "cam2" "cam3" "cam4")
INPUTS=("$CAM1_INPUT" "$CAM2_INPUT" "$CAM3_INPUT" "$CAM4_INPUT")

for i in "${!CAMERAS[@]}"; do
  CAM_RESTARTS["${CAMERAS[$i]}"]=0
  start_camera "${CAMERAS[$i]}" "${INPUTS[$i]}"
done

echo "[Multi-Camera Supervisor] All 4 camera transcoding processes running. Supervising..."

# ----------------------------------------------------------------------------
# 2. Process Supervision Loop: Detect Failures & Cleanly Restart
# ----------------------------------------------------------------------------
START_TIME=$(date +%s)

while true; do
  sleep 2
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))

  # Check duration in bounded test mode
  if [ "$DURATION" -gt 0 ] && [ "$ELAPSED" -ge "$DURATION" ]; then
    echo "[Multi-Camera Supervisor] Bounded test duration ($DURATION s) reached. Exiting cleanly."
    break
  fi

  # Check health of each camera process
  ALL_DEAD=true
  for i in "${!CAMERAS[@]}"; do
    cam="${CAMERAS[$i]}"
    pid="${CAM_PIDS[$cam]:-}"

    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      ALL_DEAD=false
    else
      # Process has stopped
      echo "[Multi-Camera Supervisor] WARNING: Camera $cam (PID $pid) died."
      if [ "$DURATION" -gt 0 ]; then
        # In test mode, process exiting after completing duration is expected
        continue
      fi

      restarts="${CAM_RESTARTS[$cam]}"
      if [ "$restarts" -lt "$MAX_RESTARTS" ]; then
        CAM_RESTARTS["$cam"]=$((restarts + 1))
        echo "[Multi-Camera Supervisor] Restarting Camera $cam (Attempt ${CAM_RESTARTS[$cam]}/$MAX_RESTARTS)..."
        start_camera "$cam" "${INPUTS[$i]}"
        ALL_DEAD=false
      else
        echo "[Multi-Camera Supervisor] ERROR: Camera $cam exceeded maximum restart threshold ($MAX_RESTARTS)."
      fi
    fi
  done

  if [ "$ALL_DEAD" = true ] && [ "$DURATION" -gt 0 ]; then
    echo "[Multi-Camera Supervisor] All camera jobs completed."
    break
  fi
done

echo "[Multi-Camera Supervisor] Transcoding pipeline supervision complete."
