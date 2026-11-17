import { NextRequest, NextResponse } from 'next/server';
import { verifyStreamToken } from '@concert/shared';

const VERIFICATION_KEY = process.env.STREAM_SIGNING_PUBLIC_KEY || process.env.JWT_SECRET || 'development_jwt_secret_test_key_min_32_chars';

/**
 * Dedicated Edge CDN Subrequest Validator (Nginx auth_request / Cloudflare Workers)
 * Validates the stream token BEFORE the CDN cache is inspected.
 * 
 * Order of operations:
 * 1. Edge receives viewer request for /live/abr/stream_1080p0.ts?token=...
 * 2. Edge triggers internal auth subrequest to this endpoint
 * 3. If this endpoint returns 200 OK:
 *      Edge normalizes cache-key to /live/abr/stream_1080p0.ts (stripping token)
 *      Edge checks cache and serves segment
 * 4. If this endpoint returns 403 Forbidden:
 *      Edge aborts request immediately, NEVER checking or serving from cache.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || request.headers.get('x-playback-token');
  const cameraId = request.nextUrl.searchParams.get('camera') || request.headers.get('x-camera-id') || undefined;

  if (!token) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing signed stream token.', valid: false },
      {
        status: 403,
        headers: {
          'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
          'Vary': 'Authorization, x-playback-token',
          'X-Edge-Auth': 'REJECTED_MISSING_TOKEN'
        }
      }
    );
  }

  const result = verifyStreamToken(token, VERIFICATION_KEY, cameraId);
  if (!result.valid) {
    return NextResponse.json(
      { error: `Unauthorized: ${result.reason || 'Invalid or expired stream token.'}`, valid: false },
      {
        status: 403,
        headers: {
          'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
          'Vary': 'Authorization, x-playback-token',
          'X-Edge-Auth': 'REJECTED_INVALID_TOKEN'
        }
      }
    );
  }

  return NextResponse.json(
    {
      valid: true,
      user: result.payload?.u || 'unknown',
      event: result.payload?.e || 'unknown',
      camera: result.payload?.c || 'default'
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
        'Vary': 'Authorization, x-playback-token',
        'X-Edge-Auth': 'ACCEPTED',
        'X-Viewer-User-Id': result.payload?.u || 'unknown',
        'X-Camera-Id': result.payload?.c || 'default'
      }
    }
  );
}

export async function HEAD(request: NextRequest) {
  const getRes = await GET(request);
  return new NextResponse(null, {
    status: getRes.status,
    headers: getRes.headers
  });
}
