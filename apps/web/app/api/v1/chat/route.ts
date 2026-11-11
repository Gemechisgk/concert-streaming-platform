import { NextResponse } from 'next/server';
import { ChatService } from '@concert/business-logic';
import { SendChatMessageSchema } from '@concert/validation';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId');
  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  }

  const messages = ChatService.getMessages(eventId);
  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = SendChatMessageSchema.parse(body);

    const message = ChatService.postMessage({
      eventId: validated.eventId,
      userId: body.userId || 'guest',
      userName: body.userName || 'Audience Member',
      userRole: body.userRole,
      text: validated.text
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 400 });
  }
}
