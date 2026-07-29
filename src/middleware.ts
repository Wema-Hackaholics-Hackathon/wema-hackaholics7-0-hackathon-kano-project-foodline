import { NextResponse, type NextRequest } from "next/server";

// Fast cookie-presence gate for the three role areas. Real authorization
// (session lookup + role check) happens server-side in each area's layout
// via requireRole(); this only spares an unauthenticated render.

const PROTECTED = ["/app", "/retailer", "/admin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!needsAuth) return NextResponse.next();
  if (request.cookies.has("fl_session")) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/app/:path*", "/retailer/:path*", "/admin/:path*"],
};
