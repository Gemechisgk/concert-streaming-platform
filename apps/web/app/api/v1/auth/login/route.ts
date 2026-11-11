import { NextResponse } from 'next/server';
import { AuthService } from '@concert/business-logic';
import { LoginSchema } from '@concert/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = LoginSchema.parse(body);

    const { user, sessionToken } = await AuthService.login(validated);
    const response = NextResponse.json({ user, sessionToken });
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.statusCode || 400 });
  }
}
