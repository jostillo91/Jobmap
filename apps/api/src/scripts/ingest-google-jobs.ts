import "dotenv/config";
import { ingestGoogleJobs } from "../ingest/google-jobs";

const location = process.argv[2] || "Phoenix, AZ";
const keyword = process.argv[3];

ingestGoogleJobs(location, keyword)
  .then(() => {
    console.log("\n✅ Google Jobs ingestion complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Google Jobs ingestion failed:", error);
    process.exit(1);
  });

