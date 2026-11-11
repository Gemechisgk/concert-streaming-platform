import { NextResponse } from 'next/server';
import { ChatService } from '@concert/business-logic';
import { ChatModerationActionSchema } from '@concert/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = ChatModerationActionSchema.parse(body);
    const eventId = body.eventId || '';

    if (validated.action === 'PIN' && validated.messageId) {
      ChatService.pinMessage(eventId, validated.messageId);
    } else if (validated.action === 'DELETE' && validated.messageId) {
      ChatService.deleteMessage(eventId, validated.messageId);
    } else if (validated.action === 'BAN_USER' && validated.targetUserId) {
      ChatService.banUser(validated.targetUserId);
    }

    return NextResponse.json({ success: true, action: validated.action });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
