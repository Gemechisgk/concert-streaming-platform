import { NextResponse } from 'next/server';
import { StreamService } from '@concert/business-logic';
import { StreamTokenRequestSchema } from '@concert/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = StreamTokenRequestSchema.parse(body);

    const { token, channel } = StreamService.authorizeStreamAccess(
      validated.ticketCode,
      validated.eventId,
      'user_viewer_01'
    );

    return NextResponse.json({
      token,
      channel: {
        id: channel.id,
        status: channel.status,
        hlsMasterUrl: channel.hlsMasterUrl,
        qualities: channel.qualities
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 400 });
  }
}
