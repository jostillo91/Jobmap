import "dotenv/config";
import { prisma } from "../lib/prisma";

/**
 * Removes duplicate jobs based on (source, sourceId) unique constraint
 * Keeps the most recent job when duplicates are found
 */
async function cleanupDuplicates() {
  console.log("🔍 Finding duplicate jobs...");

  // Find duplicates using raw SQL
  const duplicates = await prisma.$queryRawUnsafe<Array<{
    source: string;
    sourceId: string;
    count: bigint;
  }>>(
    `SELECT source, "sourceId", COUNT(*) as count
     FROM jobs
     GROUP BY source, "sourceId"
     HAVING COUNT(*) > 1`
  );

  if (duplicates.length === 0) {
    console.log("✅ No duplicates found!");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${duplicates.length} duplicate groups`);

  let totalDeleted = 0;

  for (const dup of duplicates) {
    // Get all jobs with this source/sourceId, ordered by createdAt (newest first)
    const jobs = await prisma.$queryRawUnsafe<Array<{
      id: string;
      createdAt: Date;
    }>>(
      `SELECT id, "createdAt"
       FROM jobs
       WHERE source = $1::"JobSource" AND "sourceId" = $2
       ORDER BY "createdAt" DESC`,
      dup.source,
      dup.sourceId
    );

    // Keep the first (newest) one, delete the rest
    const toDelete = jobs.slice(1);

    for (const job of toDelete) {
      await prisma.$executeRawUnsafe(`DELETE FROM jobs WHERE id = $1`, job.id);
      totalDeleted++;
    }

    console.log(`  ✓ Cleaned ${toDelete.length} duplicates for ${dup.source}:${dup.sourceId}`);
  }

  console.log(`\n✅ Cleanup complete! Deleted ${totalDeleted} duplicate jobs`);
}

cleanupDuplicates()
  .catch((error) => {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });





