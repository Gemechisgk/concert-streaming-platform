/**
 * ============================================================================
 * FESHTA FEST LIVE PLATFORM — AWS CLOUDFRONT LAMBDA@EDGE AUTH GATE
 * ============================================================================
 * Provider: AWS CloudFront + Lambda@Edge (Viewer-Request Trigger)
 * Runtime: Node.js 20.x
 * Event Type: viewer-request
 * 
 * Secret Injection Architecture:
 * - AWS explicitly DOES NOT support user-defined environment variables (process.env)
 *   in Lambda@Edge viewer-request triggers.
 * - Configuration is loaded from a deployment-bundled `edge-config.json` (generated
 *   during CI/CD synthesis from AWS Secrets Manager / Parameter Store) or injected
 *   via the factory function `createViewerRequestHandler(config)`.
 * - Fails CLOSED if secrets are missing. Never uses fallback development keys in production.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

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

export interface LambdaEdgeConfig {
  jwtSecret: string;
  originShieldSecret: string;
}

/**
 * Loads configuration from deployment-bundled edge-config.json.
 * Fails closed if the file or required secrets are not present.
 */
export function loadEdgeConfig(): LambdaEdgeConfig {
  const configPath = path.join(__dirname, 'edge-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.jwtSecret && parsed.originShieldSecret) {
        return parsed as LambdaEdgeConfig;
      }
    } catch {
      // Configuration parsing failed
    }
  }

  // Check process.env for local test runners ONLY
  if (process.env.NODE_ENV === 'test' && process.env.JWT_SECRET) {
    return {
      jwtSecret: process.env.JWT_SECRET,
      originShieldSecret: process.env.ORIGIN_SHIELD_SECRET || 'test_origin_shield_secret'
    };
  }

  throw new Error(
    'Lambda@Edge Deployment Error: Missing edge-config.json. In Lambda@Edge, secrets must be bundled at build time from AWS Secrets Manager.'
  );
}

/**
 * Cryptographic HMAC-SHA256 Token Verification using Node.js crypto module.
 * - Constant-time timingSafeEqual comparison.
 * - Standard Unix timestamp in SECONDS for exp (RFC 7519 NumericDate).
 */
export function verifyLambdaEdgeToken(token: string, secret: string): { valid: boolean; payload?: any; reason?: string } {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, reason: 'Missing token' };
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, reason: 'Malformed token structure' };
    }

    const [encodedPayload, clientSig] = parts;

    // 1. Constant-time HMAC-SHA256 calculation
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(encodedPayload)
      .digest('base64url');

    const clientBuf = Buffer.from(clientSig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');

    if (clientBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(clientBuf, expectedBuf)) {
      return { valid: false, reason: 'Invalid cryptographic signature' };
    }

    // 2. Decode payload and verify standard Unix timestamp in SECONDS
    const rawPayload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const payload = JSON.parse(rawPayload);

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || nowSeconds > payload.exp) {
      return { valid: false, reason: 'Token has expired' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, reason: 'Verification exception' };
  }
}

/**
 * Factory creating the Lambda@Edge event handler with explicit configuration.
 */
export function createViewerRequestHandler(config: LambdaEdgeConfig) {
  return async function (event: CloudFrontRequestEvent): Promise<CloudFrontRequest | CloudFrontCustomResult> {
    const request: CloudFrontRequest = event.Records[0].cf.request;
    const uri = request.uri;

    // Only gate live streaming paths
    if (!uri.includes('/live/')) {
      return request;
    }

    // Parse token from query string or x-playback-token header
    const params = new URLSearchParams(request.querystring || '');
    const token = params.get('token') || (request.headers['x-playback-token'] && request.headers['x-playback-token'][0]?.value);

    // 1. Mandatory Token Authentication BEFORE CloudFront Cache Lookup
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

    const auth = verifyLambdaEdgeToken(token, config.jwtSecret);
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
    // CloudFront's cache key will omit the viewer's token, allowing cache sharing
    if (uri.endsWith('.ts') || uri.endsWith('.m4s')) {
      params.delete('token');
      request.querystring = params.toString();
    }

    // 3. Attach Origin-Shield Mutual Secret Header
    request.headers['x-origin-shield-key'] = [{ key: 'X-Origin-Shield-Key', value: config.originShieldSecret }];
    request.headers['x-viewer-user-id'] = [{ key: 'X-Viewer-User-Id', value: auth.payload?.u || 'unknown' }];

    return request;
  };
}

/**
 * Default Lambda@Edge entrypoint.
 */
export async function handler(event: CloudFrontRequestEvent): Promise<CloudFrontRequest | CloudFrontCustomResult> {
  const config = loadEdgeConfig();
  const execute = createViewerRequestHandler(config);
  return execute(event);
}
