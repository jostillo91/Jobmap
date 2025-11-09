import "dotenv/config";
import { ingestAdzuna } from "./adzuna";
import { ingestUSAJobs } from "./usajobs";
import { ingestLinkedIn } from "./linkedin";
import { ingestIndeed } from "./indeed";
import { ingestZipRecruiter } from "./ziprecruiter";
import { ingestIndeedViaScraperAPI } from "./indeed-scraperapi";
import { ingestArizonaJobConnection } from "./arizona-job-connection";
import { isScraperAPIConfigured } from "./scraperapi";

/**
 * Runs all ingestion providers
 */
export async function ingestAll(location?: string, keyword?: string): Promise<void> {
  console.log("🚀 Starting job ingestion from all providers...\n");

  const results = {
    adzuna: { fetched: 0, normalized: 0, created: 0, updated: 0, failed: 0 },
    usajobs: { fetched: 0, normalized: 0, created: 0, updated: 0, failed: 0 },
    linkedin: { fetched: 0, normalized: 0, created: 0, updated: 0, failed: 0 },
    indeed: { fetched: 0, normalized: 0, created: 0, updated: 0, failed: 0 },
    ziprecruiter: { fetched: 0, normalized: 0, created: 0, updated: 0, failed: 0 },
    arizonaJobConnection: { fetched: 0, normalized: 0, created: 0, updated: 0, failed: 0 },
  };

  try {
    // Ingest from Adzuna
    console.log("=== Adzuna ===");
    results.adzuna = await ingestAdzuna(keyword);
    console.log("");
  } catch (error) {
    console.error("❌ Adzuna ingestion failed:", error);
    results.adzuna.failed = -1;
  }

  try {
    // Ingest from USAJOBS
    console.log("=== USAJOBS ===");
    results.usajobs = await ingestUSAJobs(keyword);
    console.log("");
  } catch (error) {
    console.error("❌ USAJOBS ingestion failed:", error);
    results.usajobs.failed = -1;
  }

  const searchLocation = location || "Phoenix, AZ";

  try {
    // Ingest from LinkedIn
    console.log("=== LinkedIn ===");
    results.linkedin = await ingestLinkedIn(searchLocation, keyword);
    console.log("");
  } catch (error) {
    console.error("❌ LinkedIn ingestion failed:", error);
    results.linkedin.failed = -1;
  }

  try {
    // Ingest from Indeed - use ScraperAPI if available, otherwise try direct scraping
    console.log("=== Indeed ===");
    if (isScraperAPIConfigured()) {
      console.log("   Using ScraperAPI for Cloudflare bypass...");
      results.indeed = await ingestIndeedViaScraperAPI(searchLocation, keyword);
    } else {
      console.log("   ScraperAPI not configured, trying direct scraping...");
      results.indeed = await ingestIndeed(searchLocation, keyword);
    }
    console.log("");
  } catch (error) {
    console.error("❌ Indeed ingestion failed:", error);
    results.indeed.failed = -1;
  }

  try {
    // Ingest from ZipRecruiter
    console.log("=== ZipRecruiter ===");
    results.ziprecruiter = await ingestZipRecruiter(searchLocation, keyword);
    console.log("");
  } catch (error) {
    console.error("❌ ZipRecruiter ingestion failed:", error);
    results.ziprecruiter.failed = -1;
  }

  try {
    // Ingest from Arizona Job Connection
    console.log("=== Arizona Job Connection ===");
    results.arizonaJobConnection = await ingestArizonaJobConnection(searchLocation, keyword);
    console.log("");
  } catch (error) {
    console.error("❌ Arizona Job Connection ingestion failed:", error);
    results.arizonaJobConnection.failed = -1;
  }

  // Summary
  console.log("=".repeat(50));
  console.log("📈 Overall Summary:");
  console.log(`   Adzuna: ${results.adzuna.created} created, ${results.adzuna.updated} updated, ${results.adzuna.failed} failed`);
  console.log(`   USAJOBS: ${results.usajobs.created} created, ${results.usajobs.updated} updated, ${results.usajobs.failed} failed`);
  console.log(`   LinkedIn: ${results.linkedin.created} created, ${results.linkedin.updated} updated, ${results.linkedin.failed} failed`);
  console.log(`   Indeed: ${results.indeed.created} created, ${results.indeed.updated} updated, ${results.indeed.failed} failed`);
  console.log(`   ZipRecruiter: ${results.ziprecruiter.created} created, ${results.ziprecruiter.updated} updated, ${results.ziprecruiter.failed} failed`);
  console.log(`   Arizona Job Connection: ${results.arizonaJobConnection.created} created, ${results.arizonaJobConnection.updated} updated, ${results.arizonaJobConnection.failed} failed`);
  console.log("=".repeat(50));
}

// CLI entry point
if (require.main === module) {
  const location = process.argv[2];
  const keyword = process.argv[3];
  
  ingestAll(location, keyword)
    .then(() => {
      console.log("\n✅ Ingestion complete");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Ingestion failed:", error);
      process.exit(1);
    });
}

