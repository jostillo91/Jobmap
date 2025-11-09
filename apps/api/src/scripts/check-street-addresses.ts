import "dotenv/config";
import { prisma } from "../lib/prisma";

async function checkStreetAddresses() {
  const withStreet = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM jobs WHERE street IS NOT NULL AND street != '' AND status = 'APPROVED'::"JobStatus"`
  );
  
  const withoutStreet = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) as count FROM jobs WHERE (street IS NULL OR street = '') AND status = 'APPROVED'::"JobStatus"`
  );

  console.log(`\n📊 Street Address Statistics:`);
  console.log(`   ✅ Jobs WITH street addresses: ${withStreet[0].count}`);
  console.log(`   ❌ Jobs WITHOUT street addresses: ${withoutStreet[0].count}`);
  console.log(`   📍 Total approved jobs: ${Number(withStreet[0].count) + Number(withoutStreet[0].count)}`);
  
  await prisma.$disconnect();
}

checkStreetAddresses()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

