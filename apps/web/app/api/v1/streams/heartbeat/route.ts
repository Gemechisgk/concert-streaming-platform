import { NextResponse } from 'next/server';
import { StreamService } from '@concert/business-logic';
import { StreamHeartbeatSchema } from '@concert/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = StreamHeartbeatSchema.parse(body);

    const ok = StreamService.recordHeartbeat(validated.streamToken);
    if (!ok) {
      return NextResponse.json({ error: 'Session expired or invalidated' }, { status: 401 });
    }

    return NextResponse.json({ status: 'active', heartbeatRecordedAt: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
