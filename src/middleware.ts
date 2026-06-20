import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};

function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="honsulmap admin"',
    },
  });
}

export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;

  // If credentials aren't configured, lock the admin surface entirely
  // so a misconfigured deploy never accidentally exposes the dashboard.
  if (!user || !pass) {
    return new NextResponse('Admin is disabled', { status: 503 });
  }

  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return unauthorized();

  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return unauthorized();
  }

  const idx = decoded.indexOf(':');
  if (idx < 0) return unauthorized();
  const suppliedUser = decoded.slice(0, idx);
  const suppliedPass = decoded.slice(idx + 1);

  if (suppliedUser !== user || suppliedPass !== pass) return unauthorized();
  return NextResponse.next();
}
