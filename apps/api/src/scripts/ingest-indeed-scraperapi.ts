import "dotenv/config";
import { ingestIndeedViaScraperAPI } from "../ingest/indeed-scraperapi";

const location = process.argv[2] || "Phoenix, AZ";
const keyword = process.argv[3];

ingestIndeedViaScraperAPI(location, keyword)
  .then(() => {
    console.log("\n✅ Indeed ingestion via ScraperAPI complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Indeed ingestion via ScraperAPI failed:", error);
    process.exit(1);
  });

