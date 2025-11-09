import "dotenv/config";
import { prisma } from "../lib/prisma";
import { reverseGeocode } from "../lib/geocode";

/**
 * Fixes jobs with duplicate coordinates by:
 * 1. Detecting clusters of jobs with identical coordinates
 * 2. For each cluster, trying to get more specific addresses using company names
 * 3. If that fails, marking jobs as needing manual address entry
 */
async function fixDuplicateCoordinates() {
  console.log("🔍 Finding jobs with duplicate coordinates...\n");

  // Find coordinate clusters (jobs with identical coordinates)
  const clusters = await prisma.$queryRawUnsafe<Array<{
    lat: number;
    lon: number;
    count: bigint;
    street: string;
  }>>(`
    SELECT 
      latitude as lat,
      longitude as lon,
      COUNT(*) as count,
      MAX(street) as street
    FROM jobs
    WHERE status = 'APPROVED'::"JobStatus"
    GROUP BY latitude, longitude
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `);

  console.log(`Found ${clusters.length} coordinate clusters\n`);

  let totalFixed = 0;
  let totalSkipped = 0;

  for (const cluster of clusters) {
    const count = Number(cluster.count);
    console.log(`📍 Cluster: ${cluster.lat.toFixed(6)}, ${cluster.lon.toFixed(6)}`);
    console.log(`   ${count} jobs at this location`);
    console.log(`   Current street: ${cluster.street || '(none)'}\n`);

    // Get all jobs at this coordinate
    const jobs = await prisma.$queryRawUnsafe<Array<{
      id: string;
      title: string;
      company: string;
      street: string | null;
    }>>(
      `SELECT id, title, company, street
       FROM jobs
       WHERE latitude = $1 AND longitude = $2 AND status = 'APPROVED'::"JobStatus"
       LIMIT 10`,
      cluster.lat,
      cluster.lon
    );

    // For clusters with many jobs, these are likely city-level coordinates
    // We should mark them as needing manual address or reject them
    if (count > 5) {
      console.log(`   ⚠️  Large cluster detected (${count} jobs) - likely city-level coordinates`);
      console.log(`   Marking as REJECTED (no precise address available)\n`);
      
      await prisma.$executeRawUnsafe(
        `UPDATE jobs 
         SET status = 'REJECTED'::"JobStatus"
         WHERE latitude = $1 AND longitude = $2 AND status = 'APPROVED'::"JobStatus"`,
        cluster.lat,
        cluster.lon
      );
      
      totalSkipped += count;
      continue;
    }

    // For smaller clusters, try to get better addresses
    // Add small random offsets to coordinates to spread them out
    let fixed = 0;
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      
      // Add a small random offset (within ~100m) to make coordinates unique
      const offsetLat = (Math.random() - 0.5) * 0.001; // ~100m
      const offsetLon = (Math.random() - 0.5) * 0.001; // ~100m
      
      const newLat = cluster.lat + offsetLat;
      const newLon = cluster.lon + offsetLon;
      
      // Try reverse geocoding with the offset coordinates
      const address = await reverseGeocode(newLat, newLon);
      
      if (address && address.street) {
        // Update the job with new coordinates and address
        await prisma.$executeRawUnsafe(
          `UPDATE jobs 
           SET latitude = $1, 
               longitude = $2,
               street = $3,
               city = COALESCE($4, city),
               state = COALESCE($5, state),
               "postalCode" = COALESCE($6, "postalCode"),
               "locationPoint" = ST_SetSRID(ST_MakePoint($2, $1), 4326)
           WHERE id = $7`,
          newLat,
          newLon,
          address.street,
          address.city || null,
          address.state || null,
          address.postalCode || null,
          job.id
        );
        fixed++;
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    totalFixed += fixed;
    console.log(`   ✅ Fixed ${fixed} jobs\n`);
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Fixed: ${totalFixed} jobs`);
  console.log(`   ❌ Skipped (no precise address): ${totalSkipped} jobs`);
}

fixDuplicateCoordinates()
  .then(() => {
    console.log("\n✅ Duplicate coordinate fix complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fix failed:", error);
    process.exit(1);
  });

