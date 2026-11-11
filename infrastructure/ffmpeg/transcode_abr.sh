#!/usr/bin/env bash
# Multi-bitrate Adaptive Bitrate (ABR) Transcoding script using FFmpeg
# Ingests master RTMP feed and creates 1080p (4500k), 720p (2500k), 480p (1000k), 360p (600k) HLS profiles

INPUT_STREAM="${1:-rtmp://localhost:1935/live/master_stream}"
OUTPUT_DIR="${2:-./objs/nginx/html/live/abr}"

mkdir -p "$OUTPUT_DIR"

ffmpeg -y -i "$INPUT_STREAM" \
  -filter_complex \
  "[v:0]split=4[v1,v2,v3,v4]; \
   [v1]scale=w=1920:h=1080[v1out]; \
   [v2]scale=w=1280:h=720[v2out]; \
   [v3]scale=w=854:h=480[v3out]; \
   [v4]scale=w=640:h=360[v4out]" \
  -map "[v1out]" -c:v:0 libx264 -b:v:0 4500k -maxrate:v:0 4800k -bufsize:v:0 9000k -g 60 -keyint_min 60 -sc_threshold 0 \
  -map "[v2out]" -c:v:1 libx264 -b:v:1 2500k -maxrate:v:1 2700k -bufsize:v:1 5000k -g 60 -keyint_min 60 -sc_threshold 0 \
  -map "[v3out]" -c:v:2 libx264 -b:v:2 1000k -maxrate:v:2 1100k -bufsize:v:2 2000k -g 60 -keyint_min 60 -sc_threshold 0 \
  -map "[v4out]" -c:v:3 libx264 -b:v:3 600k -maxrate:v:3 700k -bufsize:v:3 1200k -g 60 -keyint_min 60 -sc_threshold 0 \
  -map a:0 -c:a:0 aac -b:a:0 192k -ar 48000 \
  -map a:0 -c:a:1 aac -b:a:1 128k -ar 48000 \
  -map a:0 -c:a:2 aac -b:a:2 96k -ar 44100 \
  -map a:0 -c:a:3 aac -b:a:3 64k -ar 44100 \
  -f hls \
  -hls_time 2 \
  -hls_list_size 10 \
  -hls_flags delete_segments+independent_segments \
  -master_pl_name master.m3u8 \
  -var_stream_map "v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p v:3,a:3,name:360p" \
  "$OUTPUT_DIR/stream_%v.m3u8"
