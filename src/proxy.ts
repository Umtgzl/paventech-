import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * İyimser kontrol: oturum çerezi yoksa giriş sayfasına yönlendir.
 * Asıl yetki kontrolü veri katmanında (src/server/session.ts) her istekte yapılır.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/giris", request.url);
    const target = request.nextUrl.pathname + request.nextUrl.search;
    if (target !== "/") url.searchParams.set("donus", target);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|giris|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt)$).*)",
  ],
};
