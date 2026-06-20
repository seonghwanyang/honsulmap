import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminAuth } from '@/lib/adminAuth';

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};

export function middleware(req: NextRequest) {
  // If credentials aren't configured, lock the admin surface entirely so a
  // misconfigured deploy never accidentally exposes the dashboard.
  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
    return new NextResponse('Admin is disabled', { status: 503 });
  }

  // First wall (constant-time Basic auth). Every /api/admin handler ALSO calls
  // assertAdmin() as defense-in-depth, so a future matcher slip can't expose
  // the service-role endpoints behind it.
  if (!hasValidAdminAuth(req.headers.get('authorization'))) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="honsulmap admin"',
      },
    });
  }
  return NextResponse.next();
}
