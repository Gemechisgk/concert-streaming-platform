import { NextResponse } from 'next/server';
import { PaymentService } from '@concert/business-logic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const signature = request.headers.get('x-signature') || 'mock_sig';
  const payload = await request.json();

  const isValid = PaymentService.verifyWebhookSignature(provider.toUpperCase() as any, signature, payload);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  // Idempotently process payment state
  console.log(`[Payment Webhook] Validated ${provider} event:`, payload);
  return NextResponse.json({ received: true });
}
