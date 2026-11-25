import { apiError, apiSuccess } from "@/lib/apiResponse";
import { getDb } from "@/server/db/client";
import { getStorageProvider } from "@/server/storage";
import { PaperService } from "@/server/services/paperService";

export async function GET() {
  try {
    const db = await getDb();
    const service = new PaperService(db, getStorageProvider());
    const tree = await service.getFolderTree();
    return apiSuccess(tree);
  } catch {
    return apiError("TREE_FAILED", "Unable to build paper folder tree.", 500);
  }
}
