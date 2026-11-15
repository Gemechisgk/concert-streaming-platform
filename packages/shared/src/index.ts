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
 * Creates a cryptographically signed HMAC-SHA256 stream playback token.
 * Payload expiry `exp` is formatted as standard JWT NumericDate in UNIX SECONDS (RFC 7519 §4.1.4).
 */
export function createStreamToken(
  ticketId: string,
  eventId: string,
  userId: string,
  secret: string,
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
  const hmacSig = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${hmacSig}`;
}

/**
 * Cryptographically verifies an HMAC-SHA256 stream playback token using constant-time comparison
 * and checks expiry against standard UNIX seconds.
 */
export function verifyStreamToken(token: string, secret: string): { valid: boolean; payload?: any; reason?: string } {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, reason: 'Missing token' };
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return { valid: false, reason: 'Malformed token structure' };
    }

    const [encodedPayload, clientSig] = parts;

    // 1. Constant-time HMAC-SHA256 verification
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(encodedPayload)
      .digest('base64url');

    const clientBuf = Buffer.from(clientSig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');

    if (clientBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(clientBuf, expectedBuf)) {
      return { valid: false, reason: 'Invalid cryptographic signature' };
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
