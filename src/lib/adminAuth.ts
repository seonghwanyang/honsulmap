import { NextRequest, NextResponse } from 'next/server';

// Constant-time string compare. Pure JS so it runs in BOTH the Edge middleware
// and Node route handlers (Node's crypto.timingSafeEqual isn't available on
// Edge). The early length check leaks only the credential length, which is not
// a meaningful secret here.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// True when the request carries valid admin Basic credentials. Shared by the
// middleware (first wall) and every /api/admin handler (defense-in-depth — a
// single middleware/matcher slip then can't expose the service-role endpoints).
export function hasValidAdminAuth(authHeader: string | null): boolean {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  if (!user || !pass) return false; // unconfigured → deny

  if (!authHeader || !authHeader.startsWith('Basic ')) return false;
  let decoded: string;
  try {
    decoded = atob(authHeader.slice(6));
  } catch {
    return false;
  }
  const idx = decoded.indexOf(':');
  if (idx < 0) return false;

  // Evaluate both halves regardless of the first result so a wrong username and
  // a wrong password take the same code path (no early-out timing signal).
  const okUser = safeEqual(decoded.slice(0, idx), user);
  const okPass = safeEqual(decoded.slice(idx + 1), pass);
  return okUser && okPass;
}

// Route-handler guard. Returns a 401 response to short-circuit, or null when
// authorized:  const denied = assertAdmin(req); if (denied) return denied;
export function assertAdmin(req: NextRequest): NextResponse | null {
  if (hasValidAdminAuth(req.headers.get('authorization'))) return null;
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
