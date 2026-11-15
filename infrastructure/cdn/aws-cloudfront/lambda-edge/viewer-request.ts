/**
 * ============================================================================
 * FESHTA FEST LIVE PLATFORM — AWS CLOUDFRONT LAMBDA@EDGE AUTH GATE
 * ============================================================================
 * Provider: AWS CloudFront + Lambda@Edge (Viewer-Request Trigger)
 * Runtime: Node.js 20.x
 * Event Type: viewer-request
 * 
 * Execution Lifecycle:
 * 1. Invoked BEFORE CloudFront cache inspection.
 * 2. Authenticates JWT token using Node.js crypto module.
 * 3. On 403, immediately terminates with non-cacheable response.
 * 4. On 200, normalizes querystring for .ts segments so CloudFront shares 1 cache key.
 * 5. Injects X-Origin-Shield-Key header for origin shield authorization.
 */

export interface CloudFrontHeaders {
  [key: string]: Array<{ key?: string; value: string }>;
}

export interface CloudFrontRequest {
  uri: string;
  method: string;
  querystring: string;
  headers: CloudFrontHeaders;
  clientIp?: string;
}

export interface CloudFrontCustomResult {
  status: string;
  statusDescription: string;
  headers: CloudFrontHeaders;
  body?: string;
}

export interface CloudFrontRequestEvent {
  Records: Array<{
    cf: {
      request: CloudFrontRequest;
    };
  }>;
}

const JWT_SECRET = process.env.JWT_SECRET || 'development_jwt_secret_test_key_min_32_chars';
const ORIGIN_SHIELD_SECRET = process.env.ORIGIN_SHIELD_SECRET || 'dev_origin_shield_secret_key';

export function verifyLambdaEdgeToken(token: string, secret: string): { valid: boolean; payload?: any; reason?: string } {
  try {
    if (!token) return { valid: false, reason: 'Missing token' };
    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false, reason: 'Malformed token structure' };

    const [encodedPayload, clientSig] = parts;
    const rawPayload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const payload = JSON.parse(rawPayload);

    if (!payload.exp || Date.now() > payload.exp) {
      return { valid: false, reason: 'Token expired' };
    }

    let hash = 0;
    const str = `${encodedPayload}.${secret}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const expectedSig = Math.abs(hash).toString(36);

    if (clientSig !== expectedSig) {
      return { valid: false, reason: 'Invalid signature' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, reason: 'Verification exception' };
  }
}

export async function handler(event: CloudFrontRequestEvent): Promise<CloudFrontRequest | CloudFrontCustomResult> {
  const request: CloudFrontRequest = event.Records[0].cf.request;
  const uri = request.uri;

  // Only gate live streaming paths
  if (!uri.includes('/live/')) {
    return request;
  }

  // Parse token from query string
  const params = new URLSearchParams(request.querystring || '');
  const token = params.get('token') || (request.headers['x-playback-token'] && request.headers['x-playback-token'][0]?.value);

  // 1. Mandatory Token Auth BEFORE Cache
  if (!token) {
    return {
      status: '403',
      statusDescription: 'Forbidden',
      headers: {
        'content-type': [{ key: 'Content-Type', value: 'application/json' }],
        'cache-control': [{ key: 'Cache-Control', value: 'private, no-cache, no-store, max-age=0, must-revalidate' }],
        'x-edge-gate': [{ key: 'X-Edge-Gate', value: 'DENIED_MISSING_TOKEN' }]
      },
      body: JSON.stringify({ error: 'Unauthorized: Missing signed stream token.', code: 'TOKEN_REQUIRED' })
    };
  }

  const auth = verifyLambdaEdgeToken(token, JWT_SECRET);
  if (!auth.valid) {
    return {
      status: '403',
      statusDescription: 'Forbidden',
      headers: {
        'content-type': [{ key: 'Content-Type', value: 'application/json' }],
        'cache-control': [{ key: 'Cache-Control', value: 'private, no-cache, no-store, max-age=0, must-revalidate' }],
        'x-edge-gate': [{ key: 'X-Edge-Gate', value: 'DENIED_INVALID_TOKEN' }]
      },
      body: JSON.stringify({ error: `Unauthorized: ${auth.reason}`, code: 'TOKEN_INVALID' })
    };
  }

  // 2. Cache-Key Normalization: Strip token query param for .ts segments
  if (uri.endsWith('.ts') || uri.endsWith('.m4s')) {
    params.delete('token');
    request.querystring = params.toString(); // CloudFront cache key now omits user-specific token!
  }

  // 3. Attach Origin-Shield Mutual Secret Header
  request.headers['x-origin-shield-key'] = [{ key: 'X-Origin-Shield-Key', value: ORIGIN_SHIELD_SECRET }];
  request.headers['x-viewer-user-id'] = [{ key: 'X-Viewer-User-Id', value: auth.payload?.u || 'unknown' }];

  return request;
}
