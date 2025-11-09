import "dotenv/config";
import { ingestArizonaJobConnection } from "../ingest/arizona-job-connection";

const location = process.argv[2] || "Phoenix, AZ";
const keyword = process.argv[3];

ingestArizonaJobConnection(location, keyword)
  .then(() => {
    console.log("\n✅ Arizona Job Connection ingestion complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Arizona Job Connection ingestion failed:", error);
    process.exit(1);
  });

