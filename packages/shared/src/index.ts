import crypto from 'node:crypto';

export function formatCurrency(amountMinor: number, currency: string = 'ETB'): string {
  const amount = (amountMinor / 100).toFixed(2);
  if (currency === 'USD') return `$${amount}`;
  return `${currency} ${amount}`;
}

export function parseToCents(amount: number): number {
  return Math.round(amount * 100);
}

export const formatMinorAmount = formatCurrency;

export function generateTicketCode(eventId: string, ticketTypeId: string, sequence: number): string {
  const prefix = eventId.substring(0, 3).toUpperCase();
  const typeCode = ticketTypeId.substring(0, 3).toUpperCase();
  const randomChars = Math.random().toString(36).substring(2, 7).toUpperCase();
  const seqPadded = sequence.toString().padStart(4, '0');
  return `TKT-${prefix}-${typeCode}-${seqPadded}-${randomChars}`;
}

/**
 * Generates an asymmetric cryptographic key pair for stream playback tokens.
 * Default is EC (P-256 / prime256v1) providing compact signatures, with RSA 2048-bit option.
 */
export function generateStreamingKeyPair(type: 'ec' | 'rsa' = 'ec'): { publicKey: string; privateKey: string } {
  if (type === 'ec') {
    return crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
  }
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
}

export function isAsymmetricPrivateKey(key: string): boolean {
  return typeof key === 'string' && (key.includes('BEGIN PRIVATE KEY') || key.includes('BEGIN EC PRIVATE KEY') || key.includes('BEGIN RSA PRIVATE KEY'));
}

export function isAsymmetricPublicKey(key: string): boolean {
  return typeof key === 'string' && (key.includes('BEGIN PUBLIC KEY') || key.includes('BEGIN RSA PUBLIC KEY'));
}

/**
 * Creates a cryptographically signed stream playback token.
 * Supports asymmetric signing (EC P-256 / RSA 2048) keeping the private key on the backend,
 * or symmetric HMAC-SHA256 when a secret string is supplied.
 * Expiry `exp` is formatted as standard JWT NumericDate in UNIX SECONDS (RFC 7519 §4.1.4).
 */
export function createStreamToken(
  ticketId: string,
  eventId: string,
  userId: string,
  keyOrSecret: string,
  ttlSeconds: number = 15 * 60
): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = {
    t: ticketId,
    e: eventId,
    u: userId,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  if (isAsymmetricPrivateKey(keyOrSecret)) {
    // Asymmetric signing: private key stays secure on backend
    const isEc = keyOrSecret.includes('EC') || keyOrSecret.length < 500;
    let signatureBuffer: Buffer;
    if (isEc) {
      signatureBuffer = crypto.sign('sha256', Buffer.from(encodedPayload), {
        key: keyOrSecret,
        dsaEncoding: 'ieee-p1363'
      });
    } else {
      signatureBuffer = crypto.sign('sha256', Buffer.from(encodedPayload), keyOrSecret);
    }
    return `${encodedPayload}.${signatureBuffer.toString('base64url')}`;
  }

  // Symmetric HMAC-SHA256 signing
  const hmacSig = crypto
    .createHmac('sha256', keyOrSecret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${hmacSig}`;
}

/**
 * Cryptographically verifies a stream playback token using constant-time comparison or
 * asymmetric public key verification, and checks expiry against standard UNIX seconds.
 */
export function verifyStreamToken(token: string, keyOrSecret: string): { valid: boolean; payload?: any; reason?: string } {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, reason: 'Missing token' };
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, reason: 'Malformed token structure' };
    }

    const [encodedPayload, clientSig] = parts;
    const clientSigBuf = Buffer.from(clientSig, 'base64url');

    // 1. Signature Verification
    if (isAsymmetricPublicKey(keyOrSecret)) {
      // Asymmetric verification via Public Key (SPKI)
      const isEc = keyOrSecret.includes('MFkw') || keyOrSecret.length < 300;
      let isValid = false;
      if (isEc) {
        isValid = crypto.verify(
          'sha256',
          Buffer.from(encodedPayload),
          { key: keyOrSecret, dsaEncoding: 'ieee-p1363' },
          clientSigBuf
        );
      } else {
        isValid = crypto.verify(
          'sha256',
          Buffer.from(encodedPayload),
          keyOrSecret,
          clientSigBuf
        );
      }
      if (!isValid) {
        return { valid: false, reason: 'Invalid asymmetric cryptographic signature' };
      }
    } else {
      // Symmetric HMAC-SHA256 verification (constant-time)
      const expectedSig = crypto
        .createHmac('sha256', keyOrSecret)
        .update(encodedPayload)
        .digest('base64url');

      const clientBuf = Buffer.from(clientSig, 'utf8');
      const expectedBuf = Buffer.from(expectedSig, 'utf8');

      if (clientBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(clientBuf, expectedBuf)) {
        return { valid: false, reason: 'Invalid cryptographic signature' };
      }
    }

    // 2. Decode payload & check standard Unix seconds expiration
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'));
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (typeof payload.exp !== 'number' || nowSeconds > payload.exp) {
      return { valid: false, reason: 'Token has expired' };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, reason: 'Token verification exception' };
  }
}

// Date & Time Helpers
export function formatConcertDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatConcertTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(message: string, statusCode: number = 400, code: string = 'BAD_REQUEST', details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function sanitizeHtmlInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
