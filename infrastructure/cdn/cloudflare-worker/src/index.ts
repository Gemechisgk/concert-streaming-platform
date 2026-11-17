/**
 * ============================================================================
 * FESHTA FEST LIVE PLATFORM — CLOUDFLARE WORKER EDGE CDN AUTH GATE
 * ============================================================================
 * Provider: Cloudflare Workers (V8 Isolate Runtime)
 * Capability: Native Web Crypto Asymmetric (ECDSA P-256 / RSA 2048) & HMAC-SHA256,
 *             Cache-Key Normalization, Explicit Origin Shield Routing
 */

export interface Env {
  /**
   * Public key (SPKI PEM) for verifying asymmetrically signed tokens.
   * The private key is retained exclusively on the backend server.
   */
  STREAM_SIGNING_PUBLIC_KEY?: string;

  /**
   * Symmetric secret fallback for development / HMAC tokens.
   */
  JWT_SECRET?: string;

  /**
   * Explicit Origin Shield Hostname & Mutual Secret
   */
  ORIGIN_SHIELD_HOSTNAME: string;
  ORIGIN_SHIELD_PORT?: string;
  ORIGIN_SHIELD_SECRET: string;
}

/**
 * Native Web Crypto Asymmetric & HMAC Token Verifier
 * Compliant with RFC 7519 / RFC 7518 using crypto.subtle.verify (timing-safe).
 * Verifies ECDSA P-256 / RSA 2048 using public keys (private key retained on backend)
 * or HMAC-SHA256 for symmetric secrets.
 */
export async function verifyEdgeToken(
  token: string,
  keyOrSecret: string
): Promise<{ valid: boolean; payload?: any; reason?: string }> {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, reason: 'Missing token' };
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, reason: 'Malformed token structure' };
    }

    const [encodedPayload, clientSig] = parts;

    // 1. Decode base64url payload
    const rawPayload = atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(rawPayload);

    // 2. Validate standard Unix timestamp in SECONDS
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || nowSeconds > payload.exp) {
      return { valid: false, reason: 'Token has expired' };
    }

    // Convert base64url signature back to binary buffer
    const base64Sig = clientSig.replace(/-/g, '+').replace(/_/g, '/');
    const paddedSig = base64Sig.padEnd(base64Sig.length + ((4 - (base64Sig.length % 4)) % 4), '=');
    const binarySig = atob(paddedSig);
    const sigBytes = new Uint8Array(binarySig.length);
    for (let i = 0; i < binarySig.length; i++) {
      sigBytes[i] = binarySig.charCodeAt(i);
    }

    const dataBytes = new TextEncoder().encode(encodedPayload);

    // 3. Cryptographic Verification: Asymmetric (Public Key SPKI) or Symmetric (HMAC)
    const isAsymmetric = keyOrSecret.includes('BEGIN PUBLIC KEY') || keyOrSecret.includes('BEGIN RSA PUBLIC KEY');

    if (isAsymmetric) {
      const pem = keyOrSecret.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '');
      const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
      const isEc = pem.startsWith('MFkw') || pem.length < 300;

      let cryptoKey: CryptoKey;
      let isValid = false;

      if (isEc) {
        cryptoKey = await crypto.subtle.importKey(
          'spki',
          der.buffer,
          { name: 'ECDSA', namedCurve: 'P-256' },
          false,
          ['verify']
        );
        isValid = await crypto.subtle.verify(
          { name: 'ECDSA', hash: { name: 'SHA-256' } },
          cryptoKey,
          sigBytes,
          dataBytes
        );
      } else {
        cryptoKey = await crypto.subtle.importKey(
          'spki',
          der.buffer,
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['verify']
        );
        isValid = await crypto.subtle.verify(
          'RSASSA-PKCS1-v1_5',
          cryptoKey,
          sigBytes,
          dataBytes
        );
      }

      if (!isValid) {
        return { valid: false, reason: 'Invalid asymmetric cryptographic signature' };
      }
    } else {
      // Symmetric HMAC-SHA256 verification
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(keyOrSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, dataBytes);
      if (!isValid) {
        return { valid: false, reason: 'Invalid cryptographic signature' };
      }
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, reason: 'Token verification exception' };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isPlaylist = url.pathname.endsWith('.m3u8');
    const isSegment = url.pathname.endsWith('.ts') || url.pathname.endsWith('.m4s');

    // Only gate live streaming media paths
    if (!url.pathname.includes('/live/')) {
      return fetch(request);
    }

    // =======================================================================
    // STEP 1: MANDATORY TOKEN AUTHENTICATION BEFORE CACHE INSPECTION
    // =======================================================================
    const token = url.searchParams.get('token') || request.headers.get('x-playback-token');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing signed stream token.', code: 'TOKEN_REQUIRED' }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
            'Vary': 'Authorization, x-playback-token',
            'X-Edge-Gate': 'DENIED_MISSING_TOKEN'
          }
        }
      );
    }

    const verificationKey = env.STREAM_SIGNING_PUBLIC_KEY || env.JWT_SECRET;
    if (!verificationKey) {
      return new Response(
        JSON.stringify({ error: 'Server Misconfiguration: No verification key configured.', code: 'CONFIG_ERROR' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const authCheck = await verifyEdgeToken(token, verificationKey);
    if (!authCheck.valid) {
      return new Response(
        JSON.stringify({ error: `Unauthorized: ${authCheck.reason}`, code: 'TOKEN_INVALID' }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
            'Vary': 'Authorization, x-playback-token',
            'X-Edge-Gate': 'DENIED_INVALID_TOKEN'
          }
        }
      );
    }

    // Scoped camera authorization validation
    const requestedCamera = url.searchParams.get('camera');
    if (requestedCamera && authCheck.payload?.c && authCheck.payload.c !== requestedCamera) {
      return new Response(
        JSON.stringify({
          error: `Unauthorized: Token scoped to camera '${authCheck.payload.c}', mismatched with requested '${requestedCamera}'`,
          code: 'TOKEN_CAMERA_MISMATCH'
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
            'Vary': 'Authorization, x-playback-token',
            'X-Edge-Gate': 'DENIED_CAMERA_MISMATCH'
          }
        }
      );
    }

    // =======================================================================
    // STEP 2: NORMALIZED CACHE-KEY GENERATION (FOR .TS SEGMENTS)
    // =======================================================================
    // Strips individual viewer tokens from the cache key so all authorized viewers share the cached segment
    const normalizedUrl = new URL(request.url);
    if (isSegment) {
      normalizedUrl.search = ''; // Strip token from cache key
    }

    const cacheKey = new Request(normalizedUrl.toString(), {
      method: 'GET',
      headers: request.headers
    });

    const cache = (caches as any).default;
    let response = await cache.match(cacheKey);

    if (response) {
      const cachedHeaders = new Headers(response.headers);
      cachedHeaders.set('X-CDN-Cache-Status', 'HIT-EDGE');
      cachedHeaders.set('X-Viewer-User-Id', authCheck.payload?.u || 'unknown');
      return new Response(response.body, {
        status: response.status,
        headers: cachedHeaders
      });
    }

    // =======================================================================
    // STEP 3: EXPLICIT ORIGIN-SHIELD ROUTING & MUTUAL SECRET HEADER
    // =======================================================================
    // Explicitly construct destination URL for origin shield, preserving original path
    const originUrl = new URL(request.url);
    originUrl.protocol = 'https:';
    originUrl.hostname = env.ORIGIN_SHIELD_HOSTNAME;
    originUrl.port = env.ORIGIN_SHIELD_PORT || '443';

    // Construct origin request with mutual secret header
    const originHeaders = new Headers(request.headers);
    originHeaders.set('Host', env.ORIGIN_SHIELD_HOSTNAME);
    originHeaders.set('X-Origin-Shield-Key', env.ORIGIN_SHIELD_SECRET);
    originHeaders.set('X-Forwarded-For', request.headers.get('cf-connecting-ip') || '');

    const originRequest = new Request(originUrl.toString(), {
      method: request.method,
      headers: originHeaders
    });

    response = await fetch(originRequest);

    if (!response.ok) {
      return response;
    }

    // Process manifest rewriting or segment caching
    if (isPlaylist) {
      let manifestText = await response.text();
      // Rewrite child playlist / segment links to append active viewer token
      manifestText = manifestText.replace(/^([^#\r\n][^\r\n]*)(\r?\n|$)/gm, (match, uri, eol) => {
        if (!uri || uri.startsWith('http://') || uri.startsWith('https://')) return match;
        const separator = uri.includes('?') ? '&' : '?';
        return `${uri}${separator}token=${encodeURIComponent(token)}${eol}`;
      });

      return new Response(manifestText, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'public, max-age=1, s-maxage=2, stale-while-revalidate=1',
          'Vary': 'Authorization, x-playback-token',
          'X-CDN-Cache-Status': 'MISS-ORIGIN-PLAYLIST'
        }
      });
    }

    if (isSegment && response.status === 200) {
      const responseToCache = response.clone();
      const responseHeaders = new Headers(responseToCache.headers);
      responseHeaders.set('Cache-Control', 'public, max-age=86400, s-maxage=604800, immutable');
      responseHeaders.set('Vary', 'Authorization, x-playback-token');

      const cachedResponse = new Response(responseToCache.body, {
        status: 200,
        headers: responseHeaders
      });

      // Asynchronously store in Cloudflare Edge Cache
      await cache.put(cacheKey, cachedResponse.clone());
    }

    return response;
  }
};
