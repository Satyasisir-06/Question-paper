import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { apiError, apiSuccess, getClientIp } from "@/lib/apiResponse";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import {
  buildSessionCookieOptions,
  signSessionToken,
  verifyPassword,
} from "@/server/auth/session";
import { loginLimiter } from "@/server/security/rateLimiter";
import { loginSchema } from "@/server/validators/schemas";
import { sanitizeConnectionError } from "@/lib/env";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const quota = loginLimiter.consume(ip);
  if (!quota.allowed) {
    return apiError(
      "RATE_LIMITED",
      "Too many sign-in attempts. Wait 15 minutes and try again.",
      429,
      undefined,
      { "Retry-After": String(quota.retryAfterSeconds) }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "INVALID_CREDENTIALS",
      parsed.error.issues[0]?.message ?? "Enter a valid email and password.",
      400
    );
  }

  try {
    const db = await getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email.toLowerCase()));

    if (!user || !user.isActive) {
      return apiError("UNAUTHORIZED", "Invalid email or password.", 401);
    }

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      return apiError("UNAUTHORIZED", "Invalid email or password.", 401);
    }

    loginLimiter.reset(ip);

    const token = await signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const response = apiSuccess({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const isHttps =
      request.headers.get("x-forwarded-proto") === "https" ||
      request.nextUrl.protocol === "https:";

    response.cookies.set({
      ...buildSessionCookieOptions(undefined, isHttps),
      value: token,
    });
    return response;
  } catch (err) {
    console.error("[auth] login error:", err);
    return apiError(
      "LOGIN_FAILED",
      `Sign-in failed (${sanitizeConnectionError(err)}). Check Vercel Environment Variables and /api/v1/health.`,
      500
    );
  }
}
