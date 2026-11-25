import fs from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import * as schema from "./schema";
import { SCHEMA_DDL } from "./ddl";
import { ensureCoreCatalog } from "./seedData";

export type AppDb = PgliteDatabase<typeof schema> | NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __pvDbPromise?: Promise<AppDb>;
  __pvPglite?: PGlite;
  __pvPgPool?: Pool;
};

function cleanEnvValue(value?: string): string {
  const trimmed = value?.trim() ?? "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function resolvePgSslOption(url: string): { rejectUnauthorized: boolean } | undefined {
  if (/localhost|127\.0\.0\.1/i.test(url)) return undefined;
  if (/sslmode=(?:disable|verify-full|verify-ca)|sslrootcert=/i.test(url)) {
    return undefined;
  }
  if (/\.supabase\.(?:co|com|in)/i.test(url) || /sslmode=no-verify/i.test(url)) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

async function initDb(): Promise<AppDb> {
  const url = cleanEnvValue(process.env.DATABASE_URL) || "pglite://./data/pgdata";

  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    const [{ Pool: PgPool }, { drizzle: drizzlePg }] = await Promise.all([
      import("pg"),
      import("drizzle-orm/node-postgres"),
    ]);

    const ssl = resolvePgSslOption(url);
    const pool = new PgPool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
      ...(ssl ? { ssl } : {}),
    });
    pool.on("error", (err) => {
      console.error("[db] pg pool idle client error:", err.message);
    });
    globalForDb.__pvPgPool = pool;

    const regCheck = await pool.query<{ tbl: string | null }>(
      "SELECT to_regclass('public.papers') AS tbl"
    );
    if (!regCheck.rows[0]?.tbl) {
      try {
        await pool.query(SCHEMA_DDL);
      } catch (err) {
        const pgErr = err as { code?: string };
        // Ignore harmless concurrent enum/relation creation races on cold starts
        if (pgErr.code !== "42710" && pgErr.code !== "23505" && pgErr.code !== "42P07") {
          throw err;
        }
      }
    }

    const pgDb = drizzlePg(pool, { schema });
    if (process.env.NODE_ENV !== "test") {
      await ensureCoreCatalog(pgDb);
    }
    return pgDb;
  }

  const [{ PGlite: PGliteClient }, { drizzle: drizzlePglite }] =
    await Promise.all([
      import("@electric-sql/pglite"),
      import("drizzle-orm/pglite"),
    ]);

  const dataPath = url.startsWith("pglite://")
    ? url.slice("pglite://".length)
    : "./data/pgdata";
  const resolved = path.resolve(/*turbopackIgnore: true*/ dataPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });

  const client = new PGliteClient(resolved);
  await client.waitReady;
  await client.exec(SCHEMA_DDL);
  globalForDb.__pvPglite = client;
  return drizzlePglite(client, { schema });
}

/** Get singleton Drizzle PostgreSQL database instance shared across Next.js route chunks. */
export async function getDb(): Promise<AppDb> {
  if (!globalForDb.__pvDbPromise) {
    globalForDb.__pvDbPromise = initDb().catch((err) => {
      globalForDb.__pvDbPromise = undefined;
      console.error(
        "[db] initialization error:",
        err instanceof Error ? err.message : String(err)
      );
      throw err;
    });
  }
  return globalForDb.__pvDbPromise;
}

/** Create an isolated in-memory PGlite database for integration tests. */
export async function createInMemoryTestDb(): Promise<{
  db: PgliteDatabase<typeof schema>;
  close: () => Promise<void>;
}> {
  const [{ PGlite: PGliteClient }, { drizzle: drizzlePglite }] =
    await Promise.all([
      import("@electric-sql/pglite"),
      import("drizzle-orm/pglite"),
    ]);
  const client = new PGliteClient();
  await client.waitReady;
  await client.exec(SCHEMA_DDL);
  const db = drizzlePglite(client, { schema });
  return {
    db,
    close: async () => {
      await client.close();
    },
  };
}

/** Gracefully close active DB connections (used by CLI seed scripts and tests). */
export async function closeDb(): Promise<void> {
  if (globalForDb.__pvPglite) {
    await globalForDb.__pvPglite.close();
    globalForDb.__pvPglite = undefined;
  }
  if (globalForDb.__pvPgPool) {
    await globalForDb.__pvPgPool.end();
    globalForDb.__pvPgPool = undefined;
  }
  globalForDb.__pvDbPromise = undefined;
}
