import { NextRequest, NextResponse } from 'next/server';
import { hasValidAdminAuth } from '@/lib/adminAuth';

export const config = {
  matcher: ['/', '/feed', '/admin/:path*', '/api/admin/:path*'],
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // UTM backfill for Meta ad landings. Meta has no auto-tagging: UTMs exist
  // only if typed into the ad's URL field, and ads shipped without them
  // (2026-08-12) landed as fbclid-only, scattering paid traffic into
  // Cross-network/Unassigned in GA4. fbclid "PA…" = paid click (organic
  // shares use IwAR…), so tag those as ig/paid; campaign marks the backfill.
  if (pathname === '/' || pathname === '/feed') {
    const fbclid = req.nextUrl.searchParams.get('fbclid');
    if (fbclid?.startsWith('PA') && !req.nextUrl.searchParams.has('utm_source')) {
      const redirect = req.nextUrl.clone();
      redirect.searchParams.set('utm_source', 'ig');
      redirect.searchParams.set('utm_medium', 'paid');
      redirect.searchParams.set('utm_campaign', 'meta_untagged');
      return NextResponse.redirect(redirect, 307);
    }
    return NextResponse.next();
  }

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
