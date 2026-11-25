import { closeDb, getDb } from "./client";
import { seedDatabase, syncDefaultBranches } from "./seedData";
import { getStorageProvider } from "@/server/storage";

async function runSeed() {
  const db = await getDb();
  const storage = getStorageProvider();
  await seedDatabase(db, storage);
  await syncDefaultBranches(db);
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
