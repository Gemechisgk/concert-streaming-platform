import { NextResponse } from 'next/server';
import { EventService } from '@concert/business-logic';
import { CreateEventSchema } from '@concert/validation';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as any;
  const featuredOnly = searchParams.get('featured') === 'true';

  const events = EventService.getEvents({ status, featuredOnly });
  return NextResponse.json(
    { events },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30'
      }
    }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = CreateEventSchema.parse(body);
    const created = EventService.createEvent(validated);
    return NextResponse.json({ event: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 400 });
  }
}
