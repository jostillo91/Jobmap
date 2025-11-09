import "dotenv/config";
import { ingestIndeed } from "../ingest/indeed";

const location = process.argv[2] || "Phoenix, AZ";
const keyword = process.argv[3];

ingestIndeed(location, keyword)
  .then(() => {
    console.log("\n✅ Indeed ingestion complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Indeed ingestion failed:", error);
    process.exit(1);
  });

