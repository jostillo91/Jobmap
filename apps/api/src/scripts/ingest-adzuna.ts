import "dotenv/config";
import { ingestAdzuna } from "../ingest/adzuna";

// Get keyword and location from command line args
// Usage: pnpm ingest:adzuna [keyword] [location]
// Example: pnpm ingest:adzuna "software" "Mesa, AZ"
const keyword = process.argv[2];
const location = process.argv[3] || "Phoenix, AZ";

ingestAdzuna(keyword, location)
  .then(() => {
    console.log("\n✅ Adzuna ingestion complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Adzuna ingestion failed:", error);
    process.exit(1);
  });

