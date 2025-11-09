import "dotenv/config";
import { prisma } from "../lib/prisma";

async function checkDuplicateAddresses() {
  // Check for duplicate street addresses
  const duplicateAddresses = await prisma.$queryRawUnsafe<Array<{
    street: string;
    count: bigint;
    lat: number;
    lon: number;
  }>>(`
    SELECT street, COUNT(*) as count, AVG(latitude) as lat, AVG(longitude) as lon
    FROM jobs
    WHERE street IS NOT NULL AND street != '' AND status = 'APPROVED'::"JobStatus"
    GROUP BY street
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 20
  `);

  console.log(`\n🔍 Found ${duplicateAddresses.length} duplicate street addresses:\n`);
  
  for (const dup of duplicateAddresses) {
    console.log(`   📍 ${dup.street}`);
    console.log(`      Jobs at this address: ${dup.count}`);
    console.log(`      Avg coordinates: ${Number(dup.lat).toFixed(6)}, ${Number(dup.lon).toFixed(6)}\n`);
    
    // Get sample jobs at this address
    const jobs = await prisma.$queryRawUnsafe<Array<{
      id: string;
      title: string;
      company: string;
      latitude: number;
      longitude: number;
    }>>(
      `SELECT id, title, company, latitude, longitude 
       FROM jobs 
       WHERE street = $1 AND status = 'APPROVED'::"JobStatus"
       LIMIT 5`,
      dup.street
    );
    
    for (const job of jobs) {
      console.log(`      - ${job.company}: ${job.title}`);
      console.log(`        Coords: ${job.latitude.toFixed(6)}, ${job.longitude.toFixed(6)}`);
    }
    console.log('');
  }

  // Check coordinate precision
  const coordinatePrecision = await prisma.$queryRawUnsafe<Array<{
    lat_rounded: number;
    lon_rounded: number;
    count: bigint;
  }>>(`
    SELECT 
      ROUND(latitude::numeric, 4) as lat_rounded,
      ROUND(longitude::numeric, 4) as lon_rounded,
      COUNT(*) as count
    FROM jobs
    WHERE status = 'APPROVED'::"JobStatus"
    GROUP BY lat_rounded, lon_rounded
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 10
  `);

  console.log(`\n📍 Coordinate Clustering (rounded to 4 decimals):\n`);
  for (const cluster of coordinatePrecision) {
    console.log(`   ${Number(cluster.lat_rounded).toFixed(4)}, ${Number(cluster.lon_rounded).toFixed(4)}: ${cluster.count} jobs`);
  }

  await prisma.$disconnect();
}

checkDuplicateAddresses()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

