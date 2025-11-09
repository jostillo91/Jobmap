import "dotenv/config";
import { prisma } from "../lib/prisma";

async function checkMesaJobs() {
  const mesaJobs = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM jobs WHERE city ILIKE '%mesa%' AND status = 'APPROVED'::"JobStatus"`
  );
  
  const totalJobs = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM jobs WHERE status = 'APPROVED'::"JobStatus"`
  );

  console.log(`\n📊 Job Statistics:`);
  console.log(`   ✅ Mesa jobs: ${mesaJobs[0].count}`);
  console.log(`   📍 Total jobs: ${totalJobs[0].count}`);
  
  await prisma.$disconnect();
}

checkMesaJobs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

