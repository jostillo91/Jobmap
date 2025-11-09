import { JobSource, EmploymentType } from "@prisma/client";
import { createJobWithLocation } from "../src/lib/postgis";
import { prisma } from "../src/lib/prisma";

// Phoenix, AZ coordinates
const PHOENIX_COORDS = [
  { lat: 33.4484, lon: -112.074 }, // Downtown Phoenix
  { lat: 33.3062, lon: -111.8413 }, // Tempe
  { lat: 33.4152, lon: -111.8315 }, // Scottsdale
  { lat: 33.5722, lon: -112.088 }, // Glendale
  { lat: 33.3062, lon: -112.0112 }, // Chandler
];

async function main() {
  console.log("🌱 Seeding database...");

  const jobs = [
    {
      source: JobSource.MANUAL,
      sourceId: `seed-${Date.now()}-1`,
      title: "Software Engineer",
      company: "TechCorp Phoenix",
      description: "Join our growing team as a software engineer working on cutting-edge web applications.",
      url: "https://example.com/jobs/1",
      street: "123 Main St",
      city: "Phoenix",
      state: "AZ",
      postalCode: "85001",
      country: "US",
      latitude: PHOENIX_COORDS[0].lat,
      longitude: PHOENIX_COORDS[0].lon,
      employmentType: EmploymentType.FULL_TIME,
      payMin: 80000,
      payMax: 120000,
      payCurrency: "USD",
      postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    },
    {
      source: JobSource.MANUAL,
      sourceId: `seed-${Date.now()}-2`,
      title: "Marketing Manager",
      company: "Desert Marketing Group",
      description: "Lead marketing initiatives for local businesses in the Phoenix metro area.",
      url: "https://example.com/jobs/2",
      street: "456 Central Ave",
      city: "Tempe",
      state: "AZ",
      postalCode: "85281",
      country: "US",
      latitude: PHOENIX_COORDS[1].lat,
      longitude: PHOENIX_COORDS[1].lon,
      employmentType: EmploymentType.FULL_TIME,
      payMin: 60000,
      payMax: 85000,
      payCurrency: "USD",
      postedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    },
    {
      source: JobSource.MANUAL,
      sourceId: `seed-${Date.now()}-3`,
      title: "Sales Representative",
      company: "Arizona Sales Solutions",
      description: "B2B sales role with competitive commission structure.",
      url: "https://example.com/jobs/3",
      street: "789 Camelback Rd",
      city: "Scottsdale",
      state: "AZ",
      postalCode: "85251",
      country: "US",
      latitude: PHOENIX_COORDS[2].lat,
      longitude: PHOENIX_COORDS[2].lon,
      employmentType: EmploymentType.FULL_TIME,
      payMin: 45000,
      payMax: 70000,
      payCurrency: "USD",
      postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    },
    {
      source: JobSource.MANUAL,
      sourceId: `seed-${Date.now()}-4`,
      title: "Customer Service Specialist",
      company: "Phoenix Call Center",
      description: "Help customers via phone and email in a friendly call center environment.",
      url: "https://example.com/jobs/4",
      street: "321 W Bell Rd",
      city: "Glendale",
      state: "AZ",
      postalCode: "85308",
      country: "US",
      latitude: PHOENIX_COORDS[3].lat,
      longitude: PHOENIX_COORDS[3].lon,
      employmentType: EmploymentType.FULL_TIME,
      payMin: 35000,
      payMax: 42000,
      payCurrency: "USD",
      postedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    },
    {
      source: JobSource.MANUAL,
      sourceId: `seed-${Date.now()}-5`,
      title: "Data Analyst",
      company: "Chandler Analytics",
      description: "Analyze business data and create reports to drive decision-making.",
      url: "https://example.com/jobs/5",
      street: "555 S Arizona Ave",
      city: "Chandler",
      state: "AZ",
      postalCode: "85225",
      country: "US",
      latitude: PHOENIX_COORDS[4].lat,
      longitude: PHOENIX_COORDS[4].lon,
      employmentType: EmploymentType.FULL_TIME,
      payMin: 55000,
      payMax: 75000,
      payCurrency: "USD",
      postedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    },
  ];

  for (const jobData of jobs) {
    // Create job with PostGIS location point
    const job = await createJobWithLocation(jobData);

    console.log(`✅ Created job: ${job.title} at ${job.company}`);
  }

  console.log(`\n✨ Seeded ${jobs.length} jobs successfully!`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

