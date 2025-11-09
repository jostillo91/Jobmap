import "dotenv/config";
import { prisma } from "../lib/prisma";
import { reverseGeocode } from "../lib/geocode";

/**
 * Updates existing jobs without street addresses by reverse geocoding their coordinates
 */
async function updateStreetAddresses() {
  console.log("🔄 Finding jobs without street addresses...");

  // Find jobs without street addresses
  const jobsWithoutStreet = await prisma.$queryRawUnsafe<Array<{
    id: string;
    latitude: number;
    longitude: number;
    street: string | null;
  }>>(`
    SELECT id, latitude, longitude, street
    FROM jobs
    WHERE street IS NULL OR street = ''
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND status = 'APPROVED'::"JobStatus"
    LIMIT 100
  `);

  console.log(`   Found ${jobsWithoutStreet.length} jobs without street addresses`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < jobsWithoutStreet.length; i++) {
    const job = jobsWithoutStreet[i];
    
    if ((i + 1) % 10 === 0) {
      console.log(`   Processing ${i + 1}/${jobsWithoutStreet.length}...`);
    }

    try {
      const fullAddress = await reverseGeocode(job.latitude, job.longitude);
      
      if (fullAddress && fullAddress.street) {
        await prisma.$executeRawUnsafe(
          `UPDATE jobs SET street = $1, city = COALESCE($2, city), state = COALESCE($3, state), "postalCode" = COALESCE($4, "postalCode") WHERE id = $5`,
          fullAddress.street,
          fullAddress.city || null,
          fullAddress.state || null,
          fullAddress.postalCode || null,
          job.id
        );
        updated++;
      } else {
        // If we can't get a street address, mark as rejected (or delete)
        await prisma.$executeRawUnsafe(
          `UPDATE jobs SET status = 'REJECTED'::"JobStatus" WHERE id = $1`,
          job.id
        );
        failed++;
      }
      
      // Rate limit: wait 100ms between requests to avoid hitting Mapbox limits
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`   ❌ Failed to update job ${job.id}:`, error);
      failed++;
    }
  }

  console.log(`\n✅ Updated ${updated} jobs with street addresses`);
  console.log(`   ❌ ${failed} jobs couldn't be geocoded (marked as rejected)`);
}

updateStreetAddresses()
  .then(() => {
    console.log("\n✅ Street address update complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Street address update failed:", error);
    process.exit(1);
  });

