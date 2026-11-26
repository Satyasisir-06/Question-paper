import { NextResponse } from "next/server";
import { connection } from "next/server";
import { count } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { branches } from "@/server/db/schema";
import { getStorageProvider } from "@/server/storage";
import {
  cleanEnvValue,
  resolveDatabaseUrl,
  sanitizeConnectionError,
} from "@/lib/env";

/** Safe runtime health diagnostic endpoint exposing zero secrets. */
export async function GET() {
  await connection();
  const dbUrl = resolveDatabaseUrl();
  const storageMode = cleanEnvValue(process.env.STORAGE_PROVIDER) || "local";
  const envChecks = {
    hasPostgresUrl:
      dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://"),
    isPoolerHost: dbUrl.includes("pooler.supabase.com"),
    storageProvider: storageMode,
    hasS3Bucket: Boolean(cleanEnvValue(process.env.S3_BUCKET)),
    hasS3Keys:
      Boolean(cleanEnvValue(process.env.S3_ACCESS_KEY_ID)) &&
      Boolean(cleanEnvValue(process.env.S3_SECRET_ACCESS_KEY)),
    hasSessionSecret: cleanEnvValue(process.env.SESSION_SECRET).length >= 32,
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
    errorDetail = `DB: ${sanitizeConnectionError(err)}`;
  }

  try {
    getStorageProvider();
    storageReady = true;
  } catch (err) {
    const msg = `Storage: ${sanitizeConnectionError(err)}`;
    errorDetail = errorDetail ? `${errorDetail} | ${msg}` : msg;
  }

  if (!envChecks.hasSessionSecret) {
    const msg = "Auth: SESSION_SECRET must be set (minimum 32 characters).";
    errorDetail = errorDetail ? `${errorDetail} | ${msg}` : msg;
  }

  const ok = dbConnected && storageReady && envChecks.hasSessionSecret;
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
