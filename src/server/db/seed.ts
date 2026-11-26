import fs from "node:fs";
import path from "node:path";
import { closeDb, getDb } from "./client";
import { ensureAdminUser, seedDatabase, syncDefaultBranches } from "./seedData";
import { getStorageProvider } from "@/server/storage";

async function runSeed() {
  const envPath = path.resolve(".env");
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
    const prevDb = process.env.DATABASE_URL;
    const prevStorage = process.env.STORAGE_PROVIDER;
    const prevDir = process.env.LOCAL_STORAGE_DIR;
    process.loadEnvFile(envPath);
    if (prevDb !== undefined) process.env.DATABASE_URL = prevDb;
    if (prevStorage !== undefined) process.env.STORAGE_PROVIDER = prevStorage;
    if (prevDir !== undefined) process.env.LOCAL_STORAGE_DIR = prevDir;
  }
  if (process.argv.includes("--local")) {
    process.env.DATABASE_URL = "pglite://./data/pgdata";
    process.env.STORAGE_PROVIDER = "local";
    process.env.LOCAL_STORAGE_DIR = "./storage";
  }

  const db = await getDb();
  const storage = getStorageProvider();
  await seedDatabase(db, storage);
  await syncDefaultBranches(db);
  await ensureAdminUser(db);
  console.log("Seed completed successfully.");
}

runSeed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
