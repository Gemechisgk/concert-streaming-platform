import { NextResponse } from 'next/server';
import { AuthService } from '@concert/business-logic';
import { RegisterSchema } from '@concert/validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = RegisterSchema.parse(body);

    const { user, sessionToken } = await AuthService.register(validated);
    const response = NextResponse.json({ user, sessionToken }, { status: 201 });
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
