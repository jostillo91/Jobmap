import "dotenv/config";
import { ingestLinkedIn } from "../ingest/linkedin";

const location = process.argv[2] || "Phoenix, AZ";
const keyword = process.argv[3];

ingestLinkedIn(location, keyword)
  .then(() => {
    console.log("\n✅ LinkedIn ingestion complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ LinkedIn ingestion failed:", error);
    process.exit(1);
  });

