import { NextResponse } from 'next/server';
import { StreamService } from '@concert/business-logic';

// SRS HTTP Hook: on_publish
// SRS expects HTTP 200 with JSON { code: 0 } on success, or code != 0 on unauthorized push
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const streamKey = body.stream || '';

    const res = StreamService.handleSrsPublish(streamKey);
    return NextResponse.json({ code: res.code, message: res.message });
  } catch (err: any) {
    return NextResponse.json({ code: 1, message: err.message }, { status: 400 });
  }
}
