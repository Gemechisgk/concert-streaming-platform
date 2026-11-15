import { NextRequest, NextResponse } from 'next/server';
import { verifyStreamToken } from '@concert/shared';
import fs from 'node:fs';
import path from 'node:path';

const JWT_SECRET = process.env.JWT_SECRET || 'development_jwt_secret_test_key_min_32_chars';

// Primary and Standby Media Origins (Origin Redundancy)
const PRIMARY_ORIGIN = process.env.SRS_ORIGIN_URL || 'http://127.0.0.1:8080/live';
const STANDBY_ORIGIN = process.env.SRS_STANDBY_ORIGIN_URL || 'http://127.0.0.1:8081/live';
const ORIGIN_POOL = [PRIMARY_ORIGIN, STANDBY_ORIGIN];

// HLS storage directory: SRS output directory on disk
const HLS_BASE_DIRS = [
  path.resolve(process.cwd(), '../../infrastructure/srs/windows/SRS-Windows-x86_64-8.0-d3/objs/nginx/html/live'),
  path.resolve(process.cwd(), '../../infrastructure/srs/objs/nginx/html/live')
];

function resolveHlsFile(relativePath: string): string | null {
  for (const baseDir of HLS_BASE_DIRS) {
    try {
      const fullPath = path.join(/*turbopackIgnore: true*/ baseDir, relativePath);
      if (fs.existsSync(/*turbopackIgnore: true*/ fullPath)) {
        return fullPath;
      }
    } catch {
      // Ignore resolution error
    }
  }
  return null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await context.params;
  const relativePath = pathSegments.join('/');

  // =========================================================================
  // STEP 1: MANDATORY EDGE AUTHORIZATION BEFORE CACHE OR ORIGIN ACCESS
  // =========================================================================
  const token = request.nextUrl.searchParams.get('token') || request.headers.get('x-playback-token');

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing signed stream playback token.', code: 'TOKEN_REQUIRED' },
      {
        status: 403,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
          'Vary': 'Accept-Encoding, Authorization, x-playback-token, Range',
          'X-Edge-Auth-Status': 'REJECTED_MISSING_TOKEN'
        }
      }
    );
  }

  const tokenVerification = verifyStreamToken(token, JWT_SECRET);
  if (!tokenVerification.valid) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or expired stream token.', code: 'TOKEN_INVALID' },
      {
        status: 403,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
          'Vary': 'Accept-Encoding, Authorization, x-playback-token, Range',
          'X-Edge-Auth-Status': 'REJECTED_INVALID_TOKEN'
        }
      }
    );
  }

  // =========================================================================
  // STEP 2: AUTHORIZED CLIENT DELIVERY: DISK STORAGE CACHE
  // =========================================================================
  const localFile = resolveHlsFile(relativePath);

  if (localFile) {
    const ext = path.extname(localFile).toLowerCase();
    const isPlaylist = ext === '.m3u8';
    const isSegment = ext === '.ts' || ext === '.m4s';

    if (isPlaylist) {
      let content = fs.readFileSync(/*turbopackIgnore: true*/ localFile, 'utf8');

      // Append token to child variant and segment URIs so HLS players preserve authentication across adaptive bitrates
      content = content.replace(/^([^#\r\n][^\r\n]*)(\r?\n|$)/gm, (match, uri, eol) => {
        if (!uri || uri.startsWith('http://') || uri.startsWith('https://')) return match;
        const separator = uri.includes('?') ? '&' : '?';
        return `${uri}${separator}token=${encodeURIComponent(token)}${eol}`;
      });

      return new NextResponse(content, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'public, max-age=1, s-maxage=2, stale-while-revalidate=1',
          'Vary': 'Accept-Encoding, Authorization, x-playback-token',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'X-Playback-Session-User': tokenVerification.payload?.u || 'unknown',
          'X-CDN-Cache-Status': 'HIT-EDGE-PLAYLIST'
        }
      });
    }

    if (isSegment) {
      const buffer = fs.readFileSync(/*turbopackIgnore: true*/ localFile);
      const totalSize = buffer.length;

      // Range header handling for byte-range segment requests
      const rangeHeader = request.headers.get('range');
      if (rangeHeader && rangeHeader.startsWith('bytes=')) {
        const parts = rangeHeader.replace('bytes=', '').split('-');
        const start = parseInt(parts[0], 10) || 0;
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

        if (start < totalSize && end < totalSize && start <= end) {
          const chunk = buffer.subarray(start, end + 1);
          return new NextResponse(chunk, {
            status: 206,
            headers: {
              'Content-Type': 'video/mp2t',
              'Content-Range': `bytes ${start}-${end}/${totalSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(chunk.length),
              'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
              'Vary': 'Accept-Encoding, Authorization, x-playback-token, Range',
              'Access-Control-Allow-Origin': '*',
              'X-CDN-Cache-Status': 'HIT-EDGE-SEGMENT-PARTIAL'
            }
          });
        }
      }

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp2t',
          'Content-Length': String(totalSize),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
          'Vary': 'Accept-Encoding, Authorization, x-playback-token, Range',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'X-CDN-Cache-Status': 'HIT-EDGE-SEGMENT'
        }
      });
    }
  }

  // =========================================================================
  // STEP 3: ORIGIN REDUNDANCY FAILOVER POOL (PRIMARY -> STANDBY)
  // =========================================================================
  for (let i = 0; i < ORIGIN_POOL.length; i++) {
    const originBase = ORIGIN_POOL[i];
    const isStandby = i > 0;
    try {
      const srsOriginUrl = `${originBase}/${relativePath}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const srsRes = await fetch(srsOriginUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (srsRes.ok) {
        const contentType = srsRes.headers.get('content-type') || 'application/vnd.apple.mpegurl';
        const isPlaylist = relativePath.endsWith('.m3u8');

        if (isPlaylist) {
          let content = await srsRes.text();
          content = content.replace(/^([^#\r\n][^\r\n]*)(\r?\n|$)/gm, (match, uri, eol) => {
            if (!uri || uri.startsWith('http://') || uri.startsWith('https://')) return match;
            const separator = uri.includes('?') ? '&' : '?';
            return `${uri}${separator}token=${encodeURIComponent(token)}${eol}`;
          });

          return new NextResponse(content, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=1, s-maxage=2, stale-while-revalidate=1',
              'Vary': 'Accept-Encoding, Authorization, x-playback-token',
              'Access-Control-Allow-Origin': '*',
              'X-CDN-Cache-Status': isStandby ? 'STANDBY-ORIGIN-PLAYLIST' : 'PRIMARY-ORIGIN-PLAYLIST'
            }
          });
        }

        const blob = await srsRes.arrayBuffer();
        return new NextResponse(blob, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
            'Vary': 'Accept-Encoding, Authorization, x-playback-token, Range',
            'Access-Control-Allow-Origin': '*',
            'X-CDN-Cache-Status': isStandby ? 'STANDBY-ORIGIN-SEGMENT' : 'PRIMARY-ORIGIN-SEGMENT'
          }
        });
      }
    } catch {
      // Primary origin failed or timed out; continue loop to query standby origin
    }
  }

  return NextResponse.json(
    { error: `Stream segment not found: ${relativePath}`, code: 'SEGMENT_NOT_FOUND' },
    {
      status: 404,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        'Vary': 'Accept-Encoding, Authorization, x-playback-token'
      }
    }
  );
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const getRes = await GET(request, context);
  return new NextResponse(null, {
    status: getRes.status,
    headers: getRes.headers
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-playback-token, Range'
    }
  });
}
