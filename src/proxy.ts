import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cleanEnvValue } from "@/lib/env";

const ADMIN_GATE_COOKIE = "pv_admin_gate";

function constantTimeMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function buildGateDigest(secretKey: string): string {
  const hmacSecret = cleanEnvValue(process.env.SESSION_SECRET) || "pv-gate-salt";
  return createHmac("sha256", hmacSecret).update(secretKey).digest("hex");
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  return response;
}

/** Apply security headers, optional admin stealth gate, and optimistic cookie check on /admin routes. */
export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const portalKey = cleanEnvValue(process.env.ADMIN_PORTAL_KEY);
    if (portalKey) {
      const providedKey = searchParams.get("key") ?? "";
      const expectedDigest = buildGateDigest(portalKey);
      const gateCookie = request.cookies.get(ADMIN_GATE_COOKIE)?.value ?? "";
      const hasSessionCookie = request.cookies.has("pv_session");

      if (providedKey && constantTimeMatch(providedKey, portalKey)) {
        const cleanUrl = new URL(pathname, request.url);
        const redirectRes = NextResponse.redirect(cleanUrl);
        const isHttps =
          request.headers.get("x-forwarded-proto") === "https" ||
          request.nextUrl.protocol === "https:";
        redirectRes.cookies.set({
          name: ADMIN_GATE_COOKIE,
          value: expectedDigest,
          httpOnly: true,
          sameSite: "lax",
          secure: isHttps,
          path: "/admin",
          maxAge: 60 * 60 * 12,
        });
        return applySecurityHeaders(redirectRes);
      }

      if (!hasSessionCookie && !constantTimeMatch(gateCookie, expectedDigest)) {
        return applySecurityHeaders(
          NextResponse.rewrite(new URL("/404", request.url))
        );
      }
    }

    if (pathname !== "/admin/login" && !request.cookies.has("pv_session")) {
      return applySecurityHeaders(
        NextResponse.redirect(new URL("/admin/login", request.url))
      );
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
