import { NextResponse } from 'next/server';
import { PaymentService } from '@concert/business-logic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, orderId, amountCents, currency, customerEmail, customerPhone } = body;

    const result = await PaymentService.initializePayment(provider, {
      orderId,
      amountCents,
      currency,
      customerEmail,
      customerPhone
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 400 });
  }
}
