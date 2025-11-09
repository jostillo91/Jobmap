import "dotenv/config";
import { prisma } from "../lib/prisma";

async function countJobs() {
  const total = await prisma.job.count();
  const bySource = await prisma.$queryRawUnsafe<Array<{
    source: string;
    count: bigint;
  }>>(
    `SELECT source, COUNT(*) as count
     FROM jobs
     WHERE status = 'APPROVED'
     GROUP BY source
     ORDER BY count DESC`
  );

  const byStatus = await prisma.$queryRawUnsafe<Array<{
    status: string;
    count: bigint;
  }>>(
    `SELECT status, COUNT(*) as count
     FROM jobs
     GROUP BY status
     ORDER BY count DESC`
  );

  console.log("\n📊 Job Statistics\n");
  console.log(`Total Jobs: ${total}`);
  console.log("\nBy Source:");
  bySource.forEach((row) => {
    console.log(`  ${row.source}: ${row.count}`);
  });
  console.log("\nBy Status:");
  byStatus.forEach((row) => {
    console.log(`  ${row.status}: ${row.count}`);
  });
  console.log("");

  await prisma.$disconnect();
}

countJobs().catch(console.error);

