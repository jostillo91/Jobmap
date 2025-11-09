import "dotenv/config";
import { prisma } from "../lib/prisma";
import { reverseGeocode } from "../lib/geocode";

/**
 * Spreads out jobs with duplicate coordinates by adding small random offsets
 * This ensures each job shows as a separate dot on the map
 */
async function spreadDuplicateCoordinates() {
  console.log("🔍 Finding jobs with duplicate coordinates...\n");

  // Find coordinate clusters (jobs with identical or very similar coordinates)
  const clusters = await prisma.$queryRawUnsafe<Array<{
    lat: number;
    lon: number;
    count: bigint;
    street: string | null;
  }>>(`
    SELECT 
      ROUND(latitude::numeric, 5) as lat,
      ROUND(longitude::numeric, 5) as lon,
      COUNT(*) as count,
      MAX(street) as street
    FROM jobs
    WHERE status = 'APPROVED'::"JobStatus"
    GROUP BY ROUND(latitude::numeric, 5), ROUND(longitude::numeric, 5)
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `);

  console.log(`Found ${clusters.length} coordinate clusters\n`);

  let totalSpread = 0;

  for (const cluster of clusters) {
    const count = Number(cluster.count);
    const lat = Number(cluster.lat);
    const lon = Number(cluster.lon);
    console.log(`📍 Cluster: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    console.log(`   ${count} jobs at this location`);
    console.log(`   Street: ${cluster.street || '(none)'}\n`);

    // Get all jobs at this coordinate
    const jobs = await prisma.$queryRawUnsafe<Array<{
      id: string;
      title: string;
      company: string;
      latitude: number;
      longitude: number;
      street: string | null;
    }>>(
      `SELECT id, title, company, latitude, longitude, street
       FROM jobs
       WHERE ROUND(latitude::numeric, 5) = $1::numeric
       AND ROUND(longitude::numeric, 5) = $2::numeric
       AND status = 'APPROVED'::"JobStatus"`,
      lat.toString(),
      lon.toString()
    );

    // Spread jobs out in a grid pattern around the original location
    // Use ~50-100 meter offsets (roughly 0.0005-0.001 degrees)
    const gridSize = Math.ceil(Math.sqrt(count));
    const offsetStep = 0.0008; // ~90 meters
    
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      
      // Calculate grid position
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;
      
      // Center the grid around the original location
      const centerOffset = (gridSize - 1) * offsetStep / 2;
      const offsetLat = (row * offsetStep) - centerOffset;
      const offsetLon = (col * offsetStep) - centerOffset;
      
      const newLat = Number((lat + offsetLat).toFixed(6));
      const newLon = Number((lon + offsetLon).toFixed(6));
      
      // Try to get a better address for this offset location
      const betterAddress = await reverseGeocode(newLat, newLon);
      
      // Update the job with new coordinates
      await prisma.$executeRawUnsafe(
        `UPDATE jobs 
         SET latitude = $1::numeric, 
             longitude = $2::numeric,
             street = COALESCE($3, street),
             "locationPoint" = ST_SetSRID(ST_MakePoint($2::numeric, $1::numeric), 4326)
         WHERE id = $4`,
        newLat.toString(),
        newLon.toString(),
        betterAddress?.street || null,
        job.id
      );
      
      totalSpread++;
    }
    
    console.log(`   ✅ Spread ${jobs.length} jobs\n`);
    
    // Rate limit to avoid hitting Mapbox API limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n✅ Spread ${totalSpread} jobs to unique locations`);
}

spreadDuplicateCoordinates()
  .then(() => {
    console.log("\n✅ Coordinate spreading complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Coordinate spreading failed:", error);
    process.exit(1);
  });

