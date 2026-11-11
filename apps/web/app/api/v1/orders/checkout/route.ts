import { NextResponse } from 'next/server';
import { TicketService, PaymentService } from '@concert/business-logic';
import { CheckoutSchema } from '@concert/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = CheckoutSchema.parse(body);

    // Create order and assign tickets with concurrency verification
    const { order, tickets } = TicketService.createCheckoutOrder(validated, 'user_viewer_01');

    // Initialize payment with selected provider
    const payment = await PaymentService.initializePayment(validated.paymentProvider, {
      orderId: order.id,
      amountCents: order.totalAmountCents,
      currency: order.currency,
      customerEmail: validated.customerEmail,
      customerPhone: validated.customerPhone
    });

    return NextResponse.json({ order, tickets, payment }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 400 });
  }
}
