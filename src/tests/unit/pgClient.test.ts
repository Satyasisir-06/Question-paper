import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "@/server/db/client";

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

  it("enables TLS pool config automatically for Supabase pooler connection URLs", async () => {
    process.env.DATABASE_URL =
      '"postgresql://postgres.aeoabqclvusqdzktdcwj:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"';
    mockQuery.mockResolvedValueOnce({ rows: [{ tbl: "papers" }] });

    await getDb();
    expect(poolConfigs[0]?.ssl).toEqual({ rejectUnauthorized: false });
    expect(mockOn).toHaveBeenCalledWith("error", expect.any(Function));
  });
});
