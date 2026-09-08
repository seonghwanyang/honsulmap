import { NextResponse } from 'next/server';

// Sentry 연결 확인용. Preview·로컬에서만 의도적으로 throw해 이벤트가 Sentry에 찍히는지 본다.
// 프로덕션에서는 404. 확인이 끝나면 지워도 되고, 다음 점검 때 다시 쓰려면 두어도 된다.
export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  throw new Error(`sentry-test ${new Date().toISOString()}`);
}
