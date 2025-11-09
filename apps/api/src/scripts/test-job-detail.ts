import "dotenv/config";
import { prisma } from "../lib/prisma";

async function testJobDetail() {
  // Get a sample job using raw query (to avoid geometry deserialization issue)
  const jobs = await prisma.$queryRawUnsafe<Array<{ id: string; title: string }>>(
    `SELECT id, title FROM jobs WHERE status = 'APPROVED'::"JobStatus" LIMIT 1`
  );

  if (!jobs || jobs.length === 0) {
    console.log("No jobs found");
    await prisma.$disconnect();
    return;
  }

  const jobId = jobs[0].id;
  console.log(`Testing job detail for: ${jobId}`);
  console.log(`Title: ${jobs[0].title}`);

  // Test the API endpoint
  const response = await fetch(`http://localhost:4000/v1/jobs/${jobId}`);
  console.log(`\nAPI Response status: ${response.status}`);
  
  if (response.ok) {
    const data = await response.json();
    console.log(`✅ API Response successful!`);
    console.log(`Job title: ${data.title}`);
    console.log(`PostedAt: ${data.postedAt}`);
    console.log(`Has street: ${!!data.street}`);
  } else {
    const error = await response.text();
    console.log(`❌ API Error:`, error);
  }

  await prisma.$disconnect();
}

testJobDetail()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

