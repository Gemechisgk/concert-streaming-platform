import { NextResponse } from 'next/server';
import { GiftService } from '@concert/business-logic';

export async function GET() {
  const catalog = GiftService.getCatalog();
  return NextResponse.json(
    { catalog },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    }
  );
}
