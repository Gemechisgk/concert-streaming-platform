import assert from 'node:assert';
import { describe, it } from 'node:test';
import { TicketService } from '../../packages/business-logic/src/ticket.service';
import { StreamService } from '../../packages/business-logic/src/stream.service';
import { PaymentService } from '../../packages/business-logic/src/payment.service';
import { ChatService } from '../../packages/business-logic/src/chat.service';
import { GiftService } from '../../packages/business-logic/src/gift.service';
import { createStreamToken, verifyStreamToken, formatCurrency } from '../../packages/shared/src/index';

describe('1. Ticketing & Currency Rules', () => {
  it('formats minor integer amounts accurately in ETB and USD without float rounding bugs', () => {
    assert.strictEqual(formatCurrency(40000, 'ETB'), 'ETB 400.00');
    assert.strictEqual(formatCurrency(25000, 'ETB'), 'ETB 250.00');
    assert.strictEqual(formatCurrency(1500, 'USD'), '$15.00');
  });

  it('verifies ticket code cryptographic format and event entitlement', () => {
    const verification = TicketService.verifyTicketForEvent('TKT-TED-VIP-0001-9X8K2', 'evt_teddy_afro_01');
    assert.strictEqual(verification.valid, true);
    assert.strictEqual(verification.ticket?.ticketType.name, 'VIP');
  });

  it('rejects invalid or mismatched tickets for a different concert', () => {
    const verification = TicketService.verifyTicketForEvent('TKT-TED-VIP-0001-9X8K2', 'evt_aster_03');
    assert.strictEqual(verification.valid, false);
  });
});

describe('2. Streaming Token Security & Concurrency', () => {
  const secret = 'test_secret_key_12345';

  it('generates cryptographically verifiable signed tokens', () => {
    const token = createStreamToken('tkt_123', 'evt_456', 'usr_789', secret);
    const result = verifyStreamToken(token, secret);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.payload.t, 'tkt_123');
    assert.strictEqual(result.payload.e, 'evt_456');
    assert.strictEqual(result.payload.u, 'usr_789');
  });

  it('rejects tokens signed with an invalid secret or tampered payload', () => {
    const token = createStreamToken('tkt_123', 'evt_456', 'usr_789', secret);
    const tampered = token.slice(0, -3) + 'xyz';
    const resultTampered = verifyStreamToken(tampered, secret);
    assert.strictEqual(resultTampered.valid, false);

    const resultWrongSecret = verifyStreamToken(token, 'wrong_signature_secret');
    assert.strictEqual(resultWrongSecret.valid, false);
  });

  it('enforces single active playback session per ticket entitlement', () => {
    const session1 = StreamService.authorizeStreamAccess('TKT-TED-VIP-0001-9X8K2', 'evt_teddy_afro_01', 'user_a');
    assert.ok(session1.token);

    // Second device uses the same ticket
    const session2 = StreamService.authorizeStreamAccess('TKT-TED-VIP-0001-9X8K2', 'evt_teddy_afro_01', 'user_b');
    assert.ok(session2.token);
    assert.notStrictEqual(session1.token, session2.token);
  });
});

describe('3. Payment Adapters Integration', () => {
  it('initializes Telebirr checkout reference and minor amount', async () => {
    const res = await PaymentService.initializePayment('TELEBIRR', {
      orderId: 'ord_123',
      amountCents: 40000,
      currency: 'ETB',
      customerEmail: 'fan@example.com'
    });
    assert.strictEqual(res.provider, 'TELEBIRR');
    assert.ok(res.reference.startsWith('TB-'));
    assert.strictEqual(res.amountCents, 40000);
  });

  it('initializes CBE Birr and Stripe adapters', async () => {
    const cbe = await PaymentService.initializePayment('CBE_BIRR', {
      orderId: 'ord_124',
      amountCents: 25000,
      currency: 'ETB',
      customerEmail: 'fan@example.com'
    });
    assert.strictEqual(cbe.provider, 'CBE_BIRR');

    const stripe = await PaymentService.initializePayment('STRIPE', {
      orderId: 'ord_125',
      amountCents: 1500,
      currency: 'USD',
      customerEmail: 'fan@example.com'
    });
    assert.strictEqual(stripe.provider, 'STRIPE');
  });
});

describe('4. Live Chat Moderation & Virtual Gifts', () => {
  it('applies automated word filter to prohibited words', () => {
    const msg = ChatService.postMessage({
      eventId: 'evt_teddy_afro_01',
      userId: 'usr_clean',
      userName: 'Fan',
      text: 'Do not spam or spread hate here!'
    });
    assert.ok(msg.text.includes('***'));
    assert.ok(!msg.text.toLowerCase().includes('hate'));
  });

  it('executes virtual gift send with double-entry coin debit', () => {
    const startBalance = GiftService.getWalletBalance('guest');
    const result = GiftService.sendGift({
      eventId: 'evt_teddy_afro_01',
      userId: 'guest',
      userName: 'Guest Fan',
      giftId: 'g_rose',
      count: 1
    });
    assert.strictEqual(result.remainingBalance, startBalance - 10);
    assert.strictEqual(result.transaction.giftName, 'Rose');
  });
});
