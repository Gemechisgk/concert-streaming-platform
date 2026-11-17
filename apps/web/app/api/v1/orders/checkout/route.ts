import { NextResponse } from 'next/server';
import { TicketService, PaymentService, AuthService } from '@concert/business-logic';
import { CheckoutSchema } from '@concert/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = CheckoutSchema.parse(body);

    // Resolve user from authorization header or cookie if present
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const cookieHeader = request.headers.get('cookie') || '';
    const cookieMatch = cookieHeader.match(/session_token=([^;]+)/);
    const cookieToken = cookieMatch ? cookieMatch[1] : undefined;
    const token = bearerToken || cookieToken;

    let user = token ? await AuthService.verifySession(token) : null;
    const userId = user ? user.id : 'user_viewer_01';

    // Create order and assign tickets with concurrency verification
    const { order, tickets } = TicketService.createCheckoutOrder(validated, userId);

    // Initialize payment with selected provider
    const payment = await PaymentService.initializePayment(validated.paymentProvider, {
      orderId: order.id,
      amountCents: order.totalAmountCents,
      currency: order.currency,
      customerEmail: validated.customerEmail,
      customerPhone: validated.customerPhone
    });

    // Ensure session token exists for purchaser
    const sessionToken =
      token ||
      Buffer.from(JSON.stringify({ userId, exp: Date.now() + 86400000 * 7 })).toString('base64url');

    const response = NextResponse.json({ order, tickets, payment, sessionToken }, { status: 201 });
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 400 });
  }
}
