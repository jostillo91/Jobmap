import "dotenv/config";
import { prisma } from "../lib/prisma";
import { geocodeAddressSafe, reverseGeocode } from "../lib/geocode";

/**
 * Extracts street addresses from job descriptions and updates jobs
 */
async function extractAddressesFromDescriptions() {
  console.log("🔍 Finding jobs without street addresses...\n");

  // Find jobs without street addresses but with descriptions (including rejected ones)
  const jobsWithoutStreet = await prisma.$queryRawUnsafe<Array<{
    id: string;
    title: string;
    company: string;
    description: string;
    url: string;
    city: string | null;
    state: string | null;
    latitude: number;
    longitude: number;
    status: string;
  }>>(`
    SELECT id, title, company, description, url, city, state, latitude, longitude, status::text
    FROM jobs
    WHERE (street IS NULL OR street = '')
    AND description IS NOT NULL
    AND description != ''
    AND description != 'No description available'
    AND description != 'Description unavailable'
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
    LIMIT 500
  `);

  console.log(`Found ${jobsWithoutStreet.length} jobs to process\n`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < jobsWithoutStreet.length; i++) {
    const job = jobsWithoutStreet[i];
    
    if ((i + 1) % 10 === 0) {
      console.log(`   Processing ${i + 1}/${jobsWithoutStreet.length}...`);
    }

    try {
      // Try to extract address from description
      const addressPatterns = [
        // Full address: "123 Main St, City, State ZIP"
        /\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl|Parkway|Pkwy)[,\s]+(?:[A-Za-z\s]+,\s*)?[A-Z]{2}\s+\d{5}(?:-\d{4})?/i,
        // Address without ZIP: "123 Main St, City, State"
        /\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl|Parkway|Pkwy)[,\s]+(?:[A-Za-z\s]+,\s*)?[A-Z]{2}/i,
        // Just street address: "123 Main St"
        /\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl|Parkway|Pkwy)/i,
        // Address with suite/unit: "123 Main St, Suite 100"
        /\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl|Parkway|Pkwy)[,\s]+(?:Suite|Ste|Unit|Apt|Apartment|#)\s*\d+/i,
      ];

      let extractedAddress: string | null = null;

      // Try each pattern
      for (const pattern of addressPatterns) {
        const match = job.description.match(pattern);
        if (match) {
          extractedAddress = match[0].trim();
          // Clean up the address
          extractedAddress = extractedAddress.replace(/\s+/g, " ");
          break;
        }
      }

      // If we found an address, geocode it and update
      if (extractedAddress) {
        // Build full address for geocoding
        const fullAddress = job.city && job.state
          ? `${extractedAddress}, ${job.city}, ${job.state}`
          : extractedAddress;

        const geocodeResult = await geocodeAddressSafe(fullAddress);
        
        if (geocodeResult) {
          // Update the job with the extracted address and approve it
          await prisma.$executeRawUnsafe(
            `UPDATE jobs 
             SET street = $1,
                 latitude = $2,
                 longitude = $3,
                 "locationPoint" = ST_SetSRID(ST_MakePoint($3, $2), 4326),
                 status = 'APPROVED'::"JobStatus"
             WHERE id = $4`,
            extractedAddress,
            geocodeResult.lat,
            geocodeResult.lon,
            job.id
          );
          updated++;
        } else {
          // If geocoding fails, try reverse geocoding the existing coordinates
          const reverseGeocoded = await reverseGeocode(job.latitude, job.longitude);
          if (reverseGeocoded?.street) {
            await prisma.$executeRawUnsafe(
              `UPDATE jobs 
               SET street = $1, status = 'APPROVED'::"JobStatus"
               WHERE id = $2`,
              reverseGeocoded.street,
              job.id
            );
            updated++;
          } else {
            failed++;
          }
        }
      } else {
        // No address found in description, try reverse geocoding
        const reverseGeocoded = await reverseGeocode(job.latitude, job.longitude);
        if (reverseGeocoded?.street) {
          await prisma.$executeRawUnsafe(
            `UPDATE jobs 
             SET street = $1, status = 'APPROVED'::"JobStatus"
             WHERE id = $2`,
            reverseGeocoded.street,
            job.id
          );
          updated++;
        } else {
          failed++;
        }
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`   ❌ Failed to process job ${job.id}:`, error);
      failed++;
    }
  }

  console.log(`\n✅ Updated ${updated} jobs with street addresses`);
  console.log(`   ❌ ${failed} jobs couldn't be geocoded`);
}

extractAddressesFromDescriptions()
  .then(() => {
    console.log("\n✅ Address extraction complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Address extraction failed:", error);
    process.exit(1);
  });

