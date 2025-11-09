import "dotenv/config";
import { ingestZipRecruiter } from "../ingest/ziprecruiter";

const location = process.argv[2] || "Phoenix, AZ";
const keyword = process.argv[3];

ingestZipRecruiter(location, keyword)
  .then(() => {
    console.log("\n✅ ZipRecruiter ingestion complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ ZipRecruiter ingestion failed:", error);
    process.exit(1);
  });

