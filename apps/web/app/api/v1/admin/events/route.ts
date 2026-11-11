import { NextResponse } from 'next/server';
import { EventService } from '@concert/business-logic';
import { CreateEventSchema } from '@concert/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = CreateEventSchema.parse(body);
    const event = EventService.createEvent(validated);
    return NextResponse.json({ event }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
