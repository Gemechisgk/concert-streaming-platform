import { NextResponse } from 'next/server';
import { StreamService } from '@concert/business-logic';

// SRS HTTP Hook: on_play
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const param = body.param || ''; // ?token=...
    const urlParams = new URLSearchParams(param.replace(/^\?/, ''));
    const token = urlParams.get('token') || '';

    const res = StreamService.handleSrsPlay(token);
    return NextResponse.json({ code: res.code, message: res.message });
  } catch (err: any) {
    return NextResponse.json({ code: 1, message: err.message }, { status: 400 });
  }
}
