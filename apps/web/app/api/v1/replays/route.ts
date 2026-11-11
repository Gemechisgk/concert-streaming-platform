import { NextResponse } from 'next/server';
import { EventService } from '@concert/business-logic';

export async function GET() {
  const events = EventService.getEvents({ status: 'ENDED' });
  const replays = events.map(e => ({
    id: `rep_${e.id}`,
    eventId: e.id,
    title: e.title,
    artistName: e.artists[0]?.name || 'Featured Performer',
    thumbnailUrl: e.thumbnailImage,
    vodManifestUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    durationSeconds: 7200,
    recordedDate: e.startTime,
    isIncludedInTicket: true
  }));

  return NextResponse.json({ replays });
}
