import { prisma } from "./prisma";

/**
 * Sets the locationPoint field using PostGIS ST_MakePoint
 * Call this after creating/updating a Job record with lat/lon
 */
export async function setJobLocationPoint(
  jobId: string,
  longitude: number,
  latitude: number
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE jobs
    SET "locationPoint" = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
    WHERE id = ${jobId}
  `;
}

/**
 * Creates a job and sets the locationPoint in a transaction
 * Note: This uses raw SQL to insert with PostGIS geometry directly
 */
export async function createJobWithLocation(data: {
  source: string;
  sourceId: string;
  title: string;
  company: string;
  description: string;
  url: string;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string;
  latitude: number;
  longitude: number;
  employmentType?: string | null;
  payMin?: number | null;
  payMax?: number | null;
  payCurrency?: string | null;
  postedAt: Date;
}) {
  // Generate a cuid-like ID (simple implementation)
  const generateId = () => {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `c${timestamp}${randomPart}`;
  };

  const jobId = generateId();

  // Use raw SQL to insert with PostGIS geometry
  await prisma.$executeRaw`
    INSERT INTO jobs (
      id, source, "sourceId", title, company, description, url,
      street, city, state, "postalCode", country,
      latitude, longitude, "locationPoint",
      "employmentType", "payMin", "payMax", "payCurrency",
      "postedAt", "createdAt", "updatedAt"
    )
    VALUES (
      ${jobId},
      ${data.source}::"JobSource",
      ${data.sourceId},
      ${data.title},
      ${data.company},
      ${data.description},
      ${data.url},
      ${data.street ?? null},
      ${data.city ?? null},
      ${data.state ?? null},
      ${data.postalCode ?? null},
      ${data.country ?? "US"},
      ${data.latitude},
      ${data.longitude},
      ST_SetSRID(ST_MakePoint(${data.longitude}, ${data.latitude}), 4326),
      ${data.employmentType ?? null}::"EmploymentType",
      ${data.payMin ?? null},
      ${data.payMax ?? null},
      ${data.payCurrency ?? "USD"},
      ${data.postedAt},
      NOW(),
      NOW()
    )
  `;

  // Fetch the created job (excluding geometry column which Prisma can't deserialize)
  const jobs = await prisma.$queryRawUnsafe<Array<{
    id: string;
    source: string;
    sourceId: string;
    title: string;
    company: string;
    description: string;
    url: string;
    street: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string;
    latitude: number;
    longitude: number;
    employmentType: string | null;
    payMin: number | null;
    payMax: number | null;
    payCurrency: string | null;
    status: string;
    postedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }>>(
    `SELECT id, source, "sourceId", title, company, description, url, street, city, state, "postalCode", country, latitude, longitude, "employmentType", "payMin", "payMax", "payCurrency", status, "postedAt", "createdAt", "updatedAt" FROM jobs WHERE id = $1`,
    jobId
  );

  if (!jobs || jobs.length === 0) {
    throw new Error("Failed to create job");
  }

  return jobs[0] as any;
}

/**
 * Updates a job's location point
 */
export async function updateJobLocationPoint(
  jobId: string,
  longitude: number,
  latitude: number
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: {
      longitude,
      latitude,
    },
  });
  await setJobLocationPoint(jobId, longitude, latitude);
}

