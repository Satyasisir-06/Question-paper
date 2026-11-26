import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "@/server/db/client";
import {
  cleanEnvValue,
  extractErrorDigest,
  formatUiServerError,
  resolveDatabaseUrl,
  sanitizeConnectionError,
} from "@/lib/env";

const { mockQuery, mockEnd, mockOn, poolConfigs } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockEnd: vi.fn(),
  mockOn: vi.fn(),
  poolConfigs: [] as Array<Record<string, unknown>>,
}));

vi.mock("pg", () => {
  class MockPool {
    query = mockQuery;
    end = mockEnd;
    on = mockOn;
    constructor(config: Record<string, unknown>) {
      poolConfigs.push(config);
    }
  }
  return { Pool: MockPool };
});

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: vi.fn(() => ({ __mockPgDb: true })),
}));

describe("PostgreSQL serverless connection & cold-start recovery", () => {
  const prevUrl = process.env.DATABASE_URL;

  beforeEach(async () => {
    vi.clearAllMocks();
    poolConfigs.length = 0;
    await closeDb();
    mockEnd.mockResolvedValue(undefined);
    process.env.DATABASE_URL = "postgresql://user:pass@ep-test.neon.tech/db?sslmode=require";
  });

  afterEach(async () => {
    await closeDb();
    if (prevUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevUrl;
  });

  it("initializes schema when to_regclass is null and skips DDL when table already exists", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ tbl: null }] })
      .mockResolvedValueOnce({ rows: [] });

    await getDb();
    expect(mockQuery).toHaveBeenCalledTimes(2);

    await closeDb();
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({ rows: [{ tbl: "papers" }] });

    await getDb();
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("clears cached connection promise on transient Postgres wake failure so retry succeeds", async () => {
    mockQuery.mockRejectedValueOnce(new Error("Neon waking up"));
    await expect(getDb()).rejects.toThrow(/Neon waking up/);

    mockQuery.mockResolvedValueOnce({ rows: [{ tbl: "papers" }] });
    const recovered = await getDb();
    expect(recovered).toBeDefined();
  });

  it("enables TLS pool config automatically for Supabase pooler connection URLs and strips sslmode=require", async () => {
    process.env.DATABASE_URL =
      '"postgresql://postgres.aeoabqclvusqdzktdcwj:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"';
    mockQuery.mockResolvedValueOnce({ rows: [{ tbl: "papers" }] });

    await getDb();
    expect(poolConfigs[0]?.ssl).toEqual({ rejectUnauthorized: false });
    expect(String(poolConfigs[0]?.connectionString)).not.toContain("sslmode=require");
    expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("fails fast with clear message when Vercel runs without Postgres DATABASE_URL", async () => {
    const prevVercel = process.env.VERCEL;
    const prevPg = process.env.POSTGRES_URL;
    const prevPrisma = process.env.POSTGRES_PRISMA_URL;
    const prevNonPool = process.env.POSTGRES_URL_NON_POOLING;
    process.env.VERCEL = "1";
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.POSTGRES_PRISMA_URL;
    delete process.env.POSTGRES_URL_NON_POOLING;
    try {
      await expect(getDb()).rejects.toThrow(/DATABASE_URL is not configured for Vercel/i);
    } finally {
      if (prevVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prevVercel;
      if (prevPg === undefined) delete process.env.POSTGRES_URL;
      else process.env.POSTGRES_URL = prevPg;
      if (prevPrisma === undefined) delete process.env.POSTGRES_PRISMA_URL;
      else process.env.POSTGRES_PRISMA_URL = prevPrisma;
      if (prevNonPool === undefined) delete process.env.POSTGRES_URL_NON_POOLING;
      else process.env.POSTGRES_URL_NON_POOLING = prevNonPool;
    }
  });

  it("supports POSTGRES_URL fallback and sanitizes connection errors cleanly", async () => {
    const prevPg = process.env.POSTGRES_URL;
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = '"postgresql://postgres:secret@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"';
    mockQuery.mockResolvedValueOnce({ rows: [{ tbl: "papers" }] });
    try {
      expect(resolveDatabaseUrl()).toContain("pooler.supabase.com");
      await getDb();
      expect(poolConfigs[0]?.ssl).toEqual({ rejectUnauthorized: false });
      expect(cleanEnvValue(" 'hello' ")).toBe("hello");
      expect(
        sanitizeConnectionError(
          new Error("failed connecting to postgresql://user:pass@db.example.com:5432/postgres")
        )
      ).toBe("failed connecting to [REDACTED_DATABASE_URL]");
      expect(
        formatUiServerError(new Error("Minified React error #441"), "Fallback message")
      ).toBe("Fallback message");
      expect(extractErrorDigest({ digest: "12345" })).toBe("12345");
    } finally {
      if (prevPg === undefined) delete process.env.POSTGRES_URL;
      else process.env.POSTGRES_URL = prevPg;
    }
  });
});
