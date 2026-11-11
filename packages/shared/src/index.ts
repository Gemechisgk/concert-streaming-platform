// Currency Utilities
export function formatCurrency(amountCents: number, currency: 'ETB' | 'USD' = 'ETB'): string {
  const major = (amountCents / 100).toFixed(2);
  if (currency === 'ETB') {
    return `ETB ${Number(major).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }
  return `$${Number(major).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

export function parseToCents(amount: number): number {
  return Math.round(amount * 100);
}

// Cryptographic / Token Utilities
export function generateTicketCode(eventId: string, ticketTypeId: string, sequence: number): string {
  const prefix = eventId.substring(0, 3).toUpperCase();
  const typeCode = ticketTypeId.substring(0, 3).toUpperCase();
  const randomChars = Math.random().toString(36).substring(2, 7).toUpperCase();
  const seqPadded = sequence.toString().padStart(4, '0');
  return `TKT-${prefix}-${typeCode}-${seqPadded}-${randomChars}`;
}

export function createStreamToken(ticketId: string, eventId: string, userId: string, secret: string): string {
  const payload = {
    t: ticketId,
    e: eventId,
    u: userId,
    exp: Date.now() + 15 * 60 * 1000 // 15 mins expiry window
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  // Simple HMAC-like signature simulation for token security
  let hash = 0;
  const str = `${encoded}.${secret}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const sig = Math.abs(hash).toString(36);
  return `${encoded}.${sig}`;
}

export function verifyStreamToken(token: string, secret: string): { valid: boolean; payload?: any } {
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return { valid: false };

    let hash = 0;
    const str = `${encoded}.${secret}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const expectedSig = Math.abs(hash).toString(36);
    if (sig !== expectedSig) return { valid: false };

    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
    if (Date.now() > payload.exp) {
      return { valid: false };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false };
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

// Application Error
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'BAD_REQUEST',
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}
