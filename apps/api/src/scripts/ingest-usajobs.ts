import "dotenv/config";
import { ingestUSAJobs } from "../ingest/usajobs";

// Get keyword from command line args
const keyword = process.argv[2];

ingestUSAJobs(keyword)
  .then(() => {
    console.log("\n✅ USAJOBS ingestion complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ USAJOBS ingestion failed:", error);
    process.exit(1);
  });






