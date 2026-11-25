import { NextRequest } from "next/server";
import { apiError } from "@/lib/apiResponse";
import { getSessionUser, type SessionUser } from "./session";

/** Validate same-origin for cookie-authenticated state-changing admin requests. */
export function verifySameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Non-browser clients / curl without Origin
  const host = request.headers.get("host");
  if (!host) return false;
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host === host;
  } catch {
    return false;
  }
}

/** Enforce authenticated ADMIN or MODERATOR session on protected API routes. */
export async function requireAdminApi(
  request?: NextRequest
): Promise<
  | { authorized: true; user: SessionUser }
  | { authorized: false; response: ReturnType<typeof apiError> }
> {
  if (request && request.method !== "GET" && request.method !== "HEAD") {
    if (!verifySameOrigin(request)) {
      return {
        authorized: false,
        response: apiError("CSRF_REJECTED", "Cross-origin mutation blocked.", 403),
      };
    }
  }

  const user = await getSessionUser();
  if (!user) {
    return {
      authorized: false,
      response: apiError("UNAUTHORIZED", "Admin sign-in is required.", 401),
    };
  }

  if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
    return {
      authorized: false,
      response: apiError("FORBIDDEN", "Insufficient permissions.", 403),
    };
  }

  return { authorized: true, user };
}
