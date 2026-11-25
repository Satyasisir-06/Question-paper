import fs from "node:fs";
import path from "node:path";
import { closeDb, getDb } from "./client";
import { ensureAdminUser, seedDatabase, syncDefaultBranches } from "./seedData";
import { getStorageProvider } from "@/server/storage";

async function runSeed() {
  const envPath = path.resolve(".env");
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
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
