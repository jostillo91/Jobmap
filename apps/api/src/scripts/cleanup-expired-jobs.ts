import "dotenv/config";
import { prisma } from "../lib/prisma";

/**
 * Removes jobs older than specified days (default: 90 days)
 */
async function cleanupExpiredJobs(maxAgeDays: number = 90) {
  console.log(`🧹 Cleaning up jobs older than ${maxAgeDays} days...`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

  // Delete expired jobs
  const result = await prisma.$executeRawUnsafe(
    `DELETE FROM jobs WHERE "postedAt" < $1::timestamp`,
    cutoffDate
  );

  console.log(`✅ Deleted ${result} expired jobs`);
}

const maxAgeDays = process.argv[2] ? parseInt(process.argv[2]) : 90;

cleanupExpiredJobs(maxAgeDays)
  .catch((error) => {
    console.error("❌ Cleanup failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });





