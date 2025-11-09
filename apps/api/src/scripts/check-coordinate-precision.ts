import "dotenv/config";
import { prisma } from "../lib/prisma";

async function checkCoordinatePrecision() {
  console.log("🔍 Checking coordinate precision in database...\n");

  // Get sample jobs and check their coordinate precision
  const jobs = await prisma.$queryRawUnsafe<Array<{
    id: string;
    title: string;
    street: string | null;
    city: string | null;
    latitude: number;
    longitude: number;
    source: string;
  }>>(`
    SELECT id, title, street, city, latitude, longitude, source::text
    FROM jobs
    WHERE status = 'APPROVED'::"JobStatus"
    AND street IS NOT NULL
    AND street != ''
    LIMIT 50
  `);

  console.log(`Found ${jobs.length} jobs to check\n`);

  // Check for duplicate coordinates (potential grid pattern)
  const coordMap = new Map<string, number>();
  let duplicateCount = 0;
  let impreciseCount = 0;

  jobs.forEach((job) => {
    // Check decimal precision
    const latStr = job.latitude.toString();
    const lonStr = job.longitude.toString();
    
    // Count decimal places
    const latDecimals = latStr.includes('.') ? latStr.split('.')[1].length : 0;
    const lonDecimals = lonStr.includes('.') ? lonStr.split('.')[1].length : 0;
    
    if (latDecimals < 5 || lonDecimals < 5) {
      impreciseCount++;
      console.log(`⚠️  Low precision: ${job.title} at ${job.street}`);
      console.log(`   Lat: ${job.latitude} (${latDecimals} decimals), Lon: ${job.longitude} (${lonDecimals} decimals)`);
    }

    // Check for exact duplicates
    const coordKey = `${job.latitude},${job.longitude}`;
    if (coordMap.has(coordKey)) {
      duplicateCount++;
      const existing = coordMap.get(coordKey)!;
      console.log(`⚠️  Duplicate coordinates: ${job.title} matches ${existing} other job(s)`);
    } else {
      coordMap.set(coordKey, 1);
    }
  });

  // Check for jobs with same coordinates
  const duplicateCoords = await prisma.$queryRawUnsafe<Array<{
    latitude: number;
    longitude: number;
    count: bigint;
  }>>(`
    SELECT latitude, longitude, COUNT(*) as count
    FROM jobs
    WHERE status = 'APPROVED'::"JobStatus"
    GROUP BY latitude, longitude
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 10
  `);

  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log(`   Total jobs checked: ${jobs.length}`);
  console.log(`   Jobs with low precision (< 5 decimals): ${impreciseCount}`);
  console.log(`   Jobs with duplicate coordinates: ${duplicateCount}`);
  console.log(`   Coordinate clusters with multiple jobs: ${duplicateCoords.length}`);
  
  if (duplicateCoords.length > 0) {
    console.log("\n📍 Top coordinate clusters:");
    duplicateCoords.forEach((cluster, i) => {
      console.log(`   ${i + 1}. ${cluster.latitude}, ${cluster.longitude} - ${cluster.count} jobs`);
    });
  }

  console.log("\n💡 Recommendations:");
  if (impreciseCount > 0) {
    console.log("   - Some jobs have low coordinate precision - may need re-geocoding");
  }
  if (duplicateCoords.length > 0) {
    console.log("   - Multiple jobs share exact coordinates - this is normal for same building");
    console.log("   - Map clustering will handle these naturally");
  }
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

checkCoordinatePrecision()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

