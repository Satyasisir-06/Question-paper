import { NextResponse } from "next/server";
import { connection } from "next/server";
import { count } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { branches } from "@/server/db/schema";
import { getStorageProvider } from "@/server/storage";

function stripWrappingQuotes(value?: string): string {
  const trimmed = value?.trim() ?? "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function sanitizeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : "Unknown server error";
  return msg.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[REDACTED_DATABASE_URL]");
}

/** Safe runtime health diagnostic endpoint exposing zero secrets. */
export async function GET() {
  await connection();
  const dbUrl = stripWrappingQuotes(process.env.DATABASE_URL);
  const storageMode = stripWrappingQuotes(process.env.STORAGE_PROVIDER) || "local";
  const envChecks = {
    hasPostgresUrl:
      dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://"),
    isPoolerHost: dbUrl.includes("pooler.supabase.com"),
    storageProvider: storageMode,
    hasS3Bucket: Boolean(stripWrappingQuotes(process.env.S3_BUCKET)),
    hasS3Keys:
      Boolean(stripWrappingQuotes(process.env.S3_ACCESS_KEY_ID)) &&
      Boolean(stripWrappingQuotes(process.env.S3_SECRET_ACCESS_KEY)),
    hasSessionSecret: stripWrappingQuotes(process.env.SESSION_SECRET).length >= 32,
  };

  let dbConnected = false;
  let branchCount = 0;
  let storageReady = false;
  let errorDetail: string | null = null;

  try {
    const db = await getDb();
    const res = await db.select({ value: count() }).from(branches);
    branchCount = Number(res[0]?.value ?? 0);
    dbConnected = true;
  } catch (err) {
    errorDetail = `DB: ${sanitizeErrorMessage(err)}`;
  }

  try {
    getStorageProvider();
    storageReady = true;
  } catch (err) {
    const msg = `Storage: ${sanitizeErrorMessage(err)}`;
    errorDetail = errorDetail ? `${errorDetail} | ${msg}` : msg;
  }

  const ok = dbConnected && storageReady;
  return NextResponse.json(
    {
      ok,
      envChecks,
      dbConnected,
      branchCount,
      storageReady,
      errorDetail,
    },
    { status: ok ? 200 : 500 }
  );
}
