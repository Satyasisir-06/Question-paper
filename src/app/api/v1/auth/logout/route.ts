import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/apiResponse";
import { verifySameOrigin } from "@/server/auth/guards";
import { buildSessionCookieOptions } from "@/server/auth/session";

export async function POST(request: NextRequest) {
  if (!verifySameOrigin(request)) {
    return apiError("CSRF_REJECTED", "Cross-origin sign-out blocked.", 403);
  }

  const isHttps =
    request.headers.get("x-forwarded-proto") === "https" ||
    request.nextUrl.protocol === "https:";

  const response = apiSuccess({ signedOut: true });
  response.cookies.set({
    ...buildSessionCookieOptions(0, isHttps),
    value: "",
  });
  return response;
}
