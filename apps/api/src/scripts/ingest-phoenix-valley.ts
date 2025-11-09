import "dotenv/config";
import { ingestAdzuna } from "../ingest/adzuna";
import { ingestArizonaJobConnection } from "../ingest/arizona-job-connection";
import { ingestIndeedViaScraperAPI } from "../ingest/indeed-scraperapi";
import { ingestLinkedIn } from "../ingest/linkedin";
import { ingestZipRecruiter } from "../ingest/ziprecruiter";
import { isScraperAPIConfigured } from "../ingest/scraperapi";

/**
 * Major cities and areas in the Phoenix Valley (80-mile radius from Phoenix)
 */
const PHOENIX_VALLEY_LOCATIONS = [
  "Phoenix, AZ",
  "Mesa, AZ",
  "Tempe, AZ",
  "Scottsdale, AZ",
  "Chandler, AZ",
  "Glendale, AZ",
  "Peoria, AZ",
  "Surprise, AZ",
  "Gilbert, AZ",
  "Goodyear, AZ",
  "Avondale, AZ",
  "Buckeye, AZ",
  "Queen Creek, AZ",
  "Apache Junction, AZ",
  "Casa Grande, AZ",
  "Maricopa, AZ",
  "Eloy, AZ",
  "Coolidge, AZ",
  "Florence, AZ",
];

/**
 * Common job keywords to search for variety
 */
const JOB_KEYWORDS = [
  undefined, // General search
  "retail",
  "restaurant",
  "warehouse",
  "customer service",
  "healthcare",
  "education",
  "construction",
  "manufacturing",
  "hospitality",
  "sales",
  "administrative",
  "driver",
  "security",
  "maintenance",
];

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ingests jobs from all sources for a specific location and keyword
 */
async function ingestLocation(
  location: string,
  keyword?: string
): Promise<{
  adzuna: { created: number; updated: number; failed: number };
  arizonaJobConnection: { created: number; updated: number; failed: number };
  indeed: { created: number; updated: number; failed: number };
  linkedin: { created: number; updated: number; failed: number };
  ziprecruiter: { created: number; updated: number; failed: number };
}> {
  const results = {
    adzuna: { created: 0, updated: 0, failed: 0 },
    arizonaJobConnection: { created: 0, updated: 0, failed: 0 },
    indeed: { created: 0, updated: 0, failed: 0 },
    linkedin: { created: 0, updated: 0, failed: 0 },
    ziprecruiter: { created: 0, updated: 0, failed: 0 },
  };

  // Adzuna
  try {
    console.log(`\n📍 ${location}${keyword ? ` - ${keyword}` : ""} - Adzuna`);
    const adzunaResult = await ingestAdzuna(keyword, location);
    results.adzuna = adzunaResult;
    await sleep(2000); // Rate limiting
  } catch (error) {
    console.error(`   ❌ Adzuna failed for ${location}:`, error);
    results.adzuna.failed = -1;
  }

  // Arizona Job Connection
  try {
    console.log(`\n📍 ${location}${keyword ? ` - ${keyword}` : ""} - Arizona Job Connection`);
    const ajcResult = await ingestArizonaJobConnection(location, keyword);
    results.arizonaJobConnection = ajcResult;
    await sleep(2000); // Rate limiting
  } catch (error) {
    console.error(`   ❌ Arizona Job Connection failed for ${location}:`, error);
    results.arizonaJobConnection.failed = -1;
  }

  // Indeed (if ScraperAPI is configured)
  if (isScraperAPIConfigured()) {
    try {
      console.log(`\n📍 ${location}${keyword ? ` - ${keyword}` : ""} - Indeed`);
      const indeedResult = await ingestIndeedViaScraperAPI(location, keyword);
      results.indeed = indeedResult;
      await sleep(3000); // Rate limiting for ScraperAPI
    } catch (error) {
      console.error(`   ❌ Indeed failed for ${location}:`, error);
      results.indeed.failed = -1;
    }
  }

  // LinkedIn
  try {
    console.log(`\n📍 ${location}${keyword ? ` - ${keyword}` : ""} - LinkedIn`);
    const linkedinResult = await ingestLinkedIn(location, keyword);
    results.linkedin = linkedinResult;
    await sleep(3000); // Rate limiting
  } catch (error) {
    console.error(`   ❌ LinkedIn failed for ${location}:`, error);
    results.linkedin.failed = -1;
  }

  // ZipRecruiter
  try {
    console.log(`\n📍 ${location}${keyword ? ` - ${keyword}` : ""} - ZipRecruiter`);
    const ziprecruiterResult = await ingestZipRecruiter(location, keyword);
    results.ziprecruiter = ziprecruiterResult;
    await sleep(3000); // Rate limiting
  } catch (error) {
    console.error(`   ❌ ZipRecruiter failed for ${location}:`, error);
    results.ziprecruiter.failed = -1;
  }

  return results;
}

/**
 * Main function to ingest jobs from the entire Phoenix Valley
 */
async function ingestPhoenixValley() {
  console.log("🚀 Starting Phoenix Valley job ingestion (80-mile radius)");
  console.log(`📍 Covering ${PHOENIX_VALLEY_LOCATIONS.length} locations`);
  console.log(`🔑 Using ${JOB_KEYWORDS.length} keyword variations\n`);

  const totalResults = {
    adzuna: { created: 0, updated: 0, failed: 0 },
    arizonaJobConnection: { created: 0, updated: 0, failed: 0 },
    indeed: { created: 0, updated: 0, failed: 0 },
    linkedin: { created: 0, updated: 0, failed: 0 },
    ziprecruiter: { created: 0, updated: 0, failed: 0 },
  };

  let locationCount = 0;
  const totalLocations = PHOENIX_VALLEY_LOCATIONS.length * JOB_KEYWORDS.length;

  for (const location of PHOENIX_VALLEY_LOCATIONS) {
    for (const keyword of JOB_KEYWORDS) {
      locationCount++;
      console.log(
        `\n${"=".repeat(60)}\n[${locationCount}/${totalLocations}] Processing: ${location}${keyword ? ` - ${keyword}` : ""}\n${"=".repeat(60)}`
      );

      try {
        const results = await ingestLocation(location, keyword);

        // Aggregate results
        totalResults.adzuna.created += results.adzuna.created;
        totalResults.adzuna.updated += results.adzuna.updated;
        totalResults.adzuna.failed += results.adzuna.failed >= 0 ? results.adzuna.failed : 0;

        totalResults.arizonaJobConnection.created += results.arizonaJobConnection.created;
        totalResults.arizonaJobConnection.updated += results.arizonaJobConnection.updated;
        totalResults.arizonaJobConnection.failed +=
          results.arizonaJobConnection.failed >= 0 ? results.arizonaJobConnection.failed : 0;

        totalResults.indeed.created += results.indeed.created;
        totalResults.indeed.updated += results.indeed.updated;
        totalResults.indeed.failed += results.indeed.failed >= 0 ? results.indeed.failed : 0;

        totalResults.linkedin.created += results.linkedin.created;
        totalResults.linkedin.updated += results.linkedin.updated;
        totalResults.linkedin.failed += results.linkedin.failed >= 0 ? results.linkedin.failed : 0;

        totalResults.ziprecruiter.created += results.ziprecruiter.created;
        totalResults.ziprecruiter.updated += results.ziprecruiter.updated;
        totalResults.ziprecruiter.failed +=
          results.ziprecruiter.failed >= 0 ? results.ziprecruiter.failed : 0;

        // Progress update
        console.log(`\n✅ Completed ${locationCount}/${totalLocations}`);
        console.log(`   Total created so far: ${totalResults.adzuna.created + totalResults.arizonaJobConnection.created + totalResults.indeed.created + totalResults.linkedin.created + totalResults.ziprecruiter.created}`);

        // Rate limiting between location/keyword combinations
        await sleep(5000); // 5 second delay between searches
      } catch (error) {
        console.error(`\n❌ Failed to process ${location}${keyword ? ` - ${keyword}` : ""}:`, error);
      }
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 PHOENIX VALLEY INGESTION SUMMARY");
  console.log("=".repeat(60));
  console.log(`📍 Locations processed: ${PHOENIX_VALLEY_LOCATIONS.length}`);
  console.log(`🔑 Keyword variations: ${JOB_KEYWORDS.length}`);
  console.log(`📦 Total searches: ${totalLocations}\n`);

  console.log("Results by source:");
  console.log(`   Adzuna: ${totalResults.adzuna.created} created, ${totalResults.adzuna.updated} updated, ${totalResults.adzuna.failed} failed`);
  console.log(`   Arizona Job Connection: ${totalResults.arizonaJobConnection.created} created, ${totalResults.arizonaJobConnection.updated} updated, ${totalResults.arizonaJobConnection.failed} failed`);
  console.log(`   Indeed: ${totalResults.indeed.created} created, ${totalResults.indeed.updated} updated, ${totalResults.indeed.failed} failed`);
  console.log(`   LinkedIn: ${totalResults.linkedin.created} created, ${totalResults.linkedin.updated} updated, ${totalResults.linkedin.failed} failed`);
  console.log(`   ZipRecruiter: ${totalResults.ziprecruiter.created} created, ${totalResults.ziprecruiter.updated} updated, ${totalResults.ziprecruiter.failed} failed`);

  const totalCreated =
    totalResults.adzuna.created +
    totalResults.arizonaJobConnection.created +
    totalResults.indeed.created +
    totalResults.linkedin.created +
    totalResults.ziprecruiter.created;

  const totalUpdated =
    totalResults.adzuna.updated +
    totalResults.arizonaJobConnection.updated +
    totalResults.indeed.updated +
    totalResults.linkedin.updated +
    totalResults.ziprecruiter.updated;

  console.log(`\n🎉 TOTAL: ${totalCreated} jobs created, ${totalUpdated} jobs updated`);
  console.log("=".repeat(60));
}

// Run the ingestion
ingestPhoenixValley()
  .then(() => {
    console.log("\n✅ Phoenix Valley ingestion complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Phoenix Valley ingestion failed:", error);
    process.exit(1);
  });

