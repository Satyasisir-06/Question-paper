import { apiError, apiSuccess } from "@/lib/apiResponse";
import { getSessionUser } from "@/server/auth/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return apiError("UNAUTHORIZED", "Not signed in.", 401);
  }
  return apiSuccess(user);
}
