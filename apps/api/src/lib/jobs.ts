import { JobSource, EmploymentType, JobStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { setJobLocationPoint } from "./postgis";

export interface JobInput {
  source: JobSource;
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
  employmentType?: EmploymentType | null;
  payMin?: number | null;
  payMax?: number | null;
  payCurrency?: string | null;
  postedAt: Date;
  status?: JobStatus; // Optional - will be set based on source if not provided
}

/**
 * Upserts a job by (source, sourceId) unique constraint
 * Returns the job and whether it was created (true) or updated (false)
 */
export async function upsertJob(data: JobInput): Promise<{ job: any; created: boolean }> {
  // Validate required fields
  if (!data.sourceId || data.sourceId.trim() === "") {
    throw new Error(`sourceId is required but was: ${data.sourceId}`);
  }
  
  // Determine default status based on source
  const defaultStatus =
    data.status || (data.source === JobSource.MANUAL ? JobStatus.PENDING : JobStatus.APPROVED);

  // Check if job exists (using raw SQL to avoid geometry deserialization)
  const existingJobs = await prisma.$queryRawUnsafe<Array<{
    id: string;
    latitude: number;
    longitude: number;
  }>>(
    `SELECT id, latitude, longitude FROM jobs WHERE source = $1::"JobSource" AND "sourceId" = $2`,
    data.source,
    data.sourceId
  );

  if (existingJobs && existingJobs.length > 0) {
    const existing = existingJobs[0];
    
    // Update existing job using raw SQL
    await prisma.$executeRawUnsafe(
      `UPDATE jobs SET 
        title = $1, company = $2, description = $3, url = $4,
        street = $5, city = $6, state = $7, "postalCode" = $8, country = $9,
        latitude = $10, longitude = $11,
        "employmentType" = $12::"EmploymentType", "payMin" = $13, "payMax" = $14, "payCurrency" = $15,
        "postedAt" = $16, "updatedAt" = NOW()
        ${data.status !== undefined ? `, status = $17::"JobStatus"` : ''}
      WHERE id = $${data.status !== undefined ? '18' : '17'}`,
      data.title,
      data.company,
      data.description,
      data.url,
      data.street ?? null,
      data.city ?? null,
      data.state ?? null,
      data.postalCode ?? null,
      data.country ?? "US",
      data.latitude,
      data.longitude,
      data.employmentType ?? null,
      data.payMin ?? null,
      data.payMax ?? null,
      data.payCurrency ?? "USD",
      data.postedAt,
      ...(data.status !== undefined ? [data.status, existing.id] : [existing.id])
    );

    // Update PostGIS point if coordinates changed
    if (existing.latitude !== data.latitude || existing.longitude !== data.longitude) {
      await setJobLocationPoint(existing.id, data.longitude, data.latitude);
    }

    // Fetch updated job (excluding geometry)
    const updatedJobs = await prisma.$queryRawUnsafe<Array<{
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
      existing.id
    );

    return { job: updatedJobs[0] as any, created: false };
  } else {
    // Create new job using raw SQL to set PostGIS geometry
    const generateId = () => {
      const timestamp = Date.now().toString(36);
      const randomPart = Math.random().toString(36).substring(2, 15);
      return `c${timestamp}${randomPart}`;
    };

    const jobId = generateId();

    // Use $executeRawUnsafe to properly handle enum types
    await prisma.$executeRawUnsafe(
      `INSERT INTO jobs (
        id, source, "sourceId", title, company, description, url,
        street, city, state, "postalCode", country,
        latitude, longitude, "locationPoint",
        "employmentType", "payMin", "payMax", "payCurrency",
        status, "postedAt", "createdAt", "updatedAt"
      )
      VALUES (
        $1, $2::"JobSource", $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14,
        ST_SetSRID(ST_MakePoint($14, $13), 4326),
        $15::"EmploymentType", $16, $17, $18,
        $19::"JobStatus", $20, NOW(), NOW()
      )`,
      jobId,
      data.source,
      data.sourceId,
      data.title,
      data.company,
      data.description,
      data.url,
      data.street ?? null,
      data.city ?? null,
      data.state ?? null,
      data.postalCode ?? null,
      data.country ?? "US",
      data.latitude,
      data.longitude,
      data.employmentType ?? null,
      data.payMin ?? null,
      data.payMax ?? null,
      data.payCurrency ?? "USD",
      defaultStatus,
      data.postedAt
    );

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

    return { job: jobs[0] as any, created: true };
  }
}

