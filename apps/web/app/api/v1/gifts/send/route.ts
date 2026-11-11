import { NextResponse } from 'next/server';
import { GiftService } from '@concert/business-logic';
import { SendGiftSchema } from '@concert/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = SendGiftSchema.parse(body);

    const result = GiftService.sendGift({
      eventId: validated.eventId,
      userId: body.userId || 'guest',
      userName: body.userName || 'Audience Member',
      giftId: validated.giftId,
      count: validated.count
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 400 });
  }
}
