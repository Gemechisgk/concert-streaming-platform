import { NextResponse } from 'next/server';
import { StreamService } from '@concert/business-logic';

// SRS HTTP Hook: on_unpublish
// Triggered when a camera feed publisher disconnects or stops streaming
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const streamKey = body.stream || '';

    const res = StreamService.handleSrsUnpublish(streamKey);
    return NextResponse.json({ code: res.code, message: res.message });
  } catch (err: any) {
    return NextResponse.json({ code: 0, message: err.message });
  }
}
