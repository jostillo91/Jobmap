import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { EmploymentType } from "@prisma/client";
import { JobPin, JobDetail } from "../types/jobs";
import { captureException } from "../lib/sentry";
import { getCache, setCache, getCacheKey } from "../lib/redis";

// Query parameter schemas
const searchQuerySchema = z.object({
  bbox: z.string().regex(/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/, {
    message: "bbox must be in format: minLon,minLat,maxLon,maxLat",
  }),
  q: z.string().optional(),
  company: z.string().optional(),
  minPay: z.coerce.number().int().positive().optional(),
  maxAgeDays: z.coerce.number().int().positive().optional(),
  type: z.nativeEnum(EmploymentType).optional(), // Single type for backward compatibility
  types: z.string().optional(), // Comma-separated list of types
  limit: z.coerce.number().int().positive().max(500).default(200),
});

const jobIdSchema = z.object({
  id: z.string(),
});

/**
 * Parses bbox string to numbers
 */
function parseBbox(bbox: string): { minLon: number; minLat: number; maxLon: number; maxLat: number } {
  const [minLon, minLat, maxLon, maxLat] = bbox.split(",").map(Number);
  return { minLon, minLat, maxLon, maxLat };
}

/**
 * Converts Prisma job to JobPin format
 */
function jobToPin(job: any): JobPin {
  // Handle date conversion (raw query returns Date objects or strings)
  const postedAt = job.postedAt instanceof Date 
    ? job.postedAt.toISOString() 
    : new Date(job.postedAt).toISOString();

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    url: job.url,
    lat: job.latitude,
    lon: job.longitude,
    payMin: job.payMin ?? undefined,
    payMax: job.payMax ?? undefined,
    postedAt,
    street: job.street ?? undefined,
    city: job.city ?? undefined,
    state: job.state ?? undefined,
    employmentType: job.employmentType ?? undefined,
    source: job.source,
  };
}

/**
 * Converts Prisma job to JobDetail format
 */
function jobToDetail(job: any): JobDetail {
  // Handle date conversion safely (raw query returns Date objects or strings)
  const postedAt = job.postedAt instanceof Date 
    ? job.postedAt.toISOString() 
    : typeof job.postedAt === 'string' 
      ? job.postedAt 
      : new Date(job.postedAt).toISOString();
  
  const createdAt = job.createdAt instanceof Date 
    ? job.createdAt.toISOString() 
    : typeof job.createdAt === 'string' 
      ? job.createdAt 
      : new Date(job.createdAt).toISOString();
  
  const updatedAt = job.updatedAt instanceof Date 
    ? job.updatedAt.toISOString() 
    : typeof job.updatedAt === 'string' 
      ? job.updatedAt 
      : new Date(job.updatedAt).toISOString();

  return {
    id: job.id,
    source: job.source,
    sourceId: job.sourceId,
    title: job.title,
    company: job.company,
    description: job.description,
    url: job.url,
    street: job.street ?? undefined,
    city: job.city ?? undefined,
    state: job.state ?? undefined,
    postalCode: job.postalCode ?? undefined,
    country: job.country,
    latitude: job.latitude,
    longitude: job.longitude,
    employmentType: job.employmentType ?? undefined,
    payMin: job.payMin ?? undefined,
    payMax: job.payMax ?? undefined,
    payCurrency: job.payCurrency ?? undefined,
    postedAt,
    createdAt,
    updatedAt,
  };
}

/**
 * Registers job routes
 */
export async function jobsRoutes(fastify: FastifyInstance) {
  // Search jobs by bounding box
  fastify.get<{ Querystring: z.infer<typeof searchQuerySchema> }>(
    "/v1/jobs/search",
    async (request, reply) => {
      try {
        // Validate query parameters
        const params = searchQuerySchema.parse(request.query);
        const { minLon, minLat, maxLon, maxLat } = parseBbox(params.bbox);

        // Check cache first
        const cacheKey = getCacheKey("jobs:search", {
          bbox: params.bbox,
          q: params.q || "",
          company: params.company || "",
          minPay: params.minPay || 0,
          maxAgeDays: params.maxAgeDays || 0,
          types: params.types || params.type || "",
          limit: params.limit,
        });

        const cached = await getCache<{ jobs: JobPin[]; count: number }>(cacheKey);
        if (cached) {
          // Add cache header for debugging
          reply.header("X-Cache", "HIT");
          return cached;
        }

        // Build WHERE conditions array
        const whereParts: string[] = [];
        const queryArgs: any[] = [];
        let argIndex = 1;

        // Bounding box filter using PostGIS (always required)
        whereParts.push(
          `ST_Intersects("locationPoint", ST_MakeEnvelope($${argIndex}, $${argIndex + 1}, $${argIndex + 2}, $${argIndex + 3}, 4326))`
        );
        queryArgs.push(minLon, minLat, maxLon, maxLat);
        argIndex += 4;

        // Keyword search (title or description)
        if (params.q) {
          const searchTerm = `%${params.q.toLowerCase()}%`;
          whereParts.push(`(LOWER(title) LIKE $${argIndex} OR LOWER(description) LIKE $${argIndex})`);
          queryArgs.push(searchTerm);
          argIndex++;
        }

        // Company filter
        if (params.company) {
          const companyTerm = `%${params.company.toLowerCase()}%`;
          whereParts.push(`LOWER(company) LIKE $${argIndex}`);
          queryArgs.push(companyTerm);
          argIndex++;
        }

        // Pay filter (check if payMax >= minPay or payMin >= minPay)
        if (params.minPay) {
          whereParts.push(`("payMax" >= $${argIndex} OR "payMin" >= $${argIndex})`);
          queryArgs.push(params.minPay);
          argIndex++;
        }

        // Age filter (posted within last N days)
        if (params.maxAgeDays) {
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - params.maxAgeDays);
          whereParts.push(`"postedAt" >= $${argIndex}::timestamp`);
          queryArgs.push(cutoffDate);
          argIndex++;
        }

        // Employment type filter (support both single type and multiple types)
        if (params.types) {
          // Multiple types (comma-separated)
          const types = params.types.split(",").map((t) => t.trim());
          const typeConditions: string[] = [];
          types.forEach((type) => {
            typeConditions.push(`"employmentType" = $${argIndex}::"EmploymentType"`);
            queryArgs.push(type);
            argIndex++;
          });
          whereParts.push(`(${typeConditions.join(" OR ")})`);
        } else if (params.type) {
          // Single type (backward compatibility)
          whereParts.push(`"employmentType" = $${argIndex}::"EmploymentType"`);
          queryArgs.push(params.type);
          argIndex++;
        }

        // Only show approved jobs
        whereParts.push(`status = 'APPROVED'::"JobStatus"`);
        
        // Only show jobs with street addresses (required for physical visits)
        whereParts.push(`street IS NOT NULL AND street != ''`);

        // Build final query
        const whereClause = whereParts.join(" AND ");
        queryArgs.push(params.limit); // For LIMIT

        // Optimize query: Use index-friendly ordering and add EXPLAIN hints
        // Status filter is applied first (uses index), then ordered by postedAt (uses composite index)
        const query = `
          SELECT 
            id, title, company, url, latitude, longitude,
            "payMin", "payMax", "postedAt", street, city, state,
            "employmentType", source
          FROM jobs
          WHERE ${whereClause}
          ORDER BY "postedAt" DESC NULLS LAST
          LIMIT $${argIndex}
        `;

        // Execute query using Prisma's unsafe raw query (needed for dynamic WHERE clause)
        const jobs = await prisma.$queryRawUnsafe<any[]>(query, ...queryArgs);

        // Convert to JobPin format
        const pins: JobPin[] = (jobs as any[]).map(jobToPin);

        const result = {
          jobs: pins,
          count: pins.length,
        };

        // Cache the result
        // Cache for 5 minutes (300 seconds) - adjust based on your needs
        // Shorter TTL for searches with filters (they change more often)
        const ttl = params.q || params.company || params.minPay || params.maxAgeDays ? 180 : 300;
        await setCache(cacheKey, result, ttl);

        reply.header("X-Cache", "MISS");
        return result;
      } catch (error) {
        if (error instanceof z.ZodError) {
          reply.code(400).send({
            error: "Invalid query parameters",
            details: error.errors,
          });
          return;
        }

        fastify.log.error(error);
        if (error instanceof Error) {
          captureException(error, {
            route: "/v1/jobs/search",
            method: "GET",
            query: request.query,
          });
        }
        reply.code(500).send({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // Get job by ID
  fastify.get<{ Params: z.infer<typeof jobIdSchema> }>("/v1/jobs/:id", async (request, reply) => {
    try {
      const { id } = jobIdSchema.parse(request.params);

      // Use raw query to get all fields including dates
      const jobs = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT 
          id, source, "sourceId", title, company, description, url,
          street, city, state, "postalCode", country,
          latitude, longitude,
          "employmentType", "payMin", "payMax", "payCurrency",
          "postedAt", "createdAt", "updatedAt"
        FROM jobs
        WHERE id = $1 AND status = 'APPROVED'::"JobStatus"`,
        id
      );

      if (!jobs || jobs.length === 0) {
        reply.code(404).send({
          error: "Job not found",
        });
        return;
      }

      return jobToDetail(jobs[0]);
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          error: "Invalid job ID",
          details: error.errors,
        });
        return;
      }

      fastify.log.error(error);
      if (error instanceof Error) {
        captureException(error, {
          route: "/v1/jobs/:id",
          method: "GET",
          params: request.params,
        });
      }
      reply.code(500).send({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Get search suggestions (job titles and companies)
  fastify.get<{ Querystring: { q: string; type?: "title" | "company" } }>(
    "/v1/jobs/suggestions",
    async (request, reply) => {
      try {
        const { q, type } = request.query;
        
        if (!q || q.length < 2) {
          return { suggestions: [] };
        }

        // Check cache first
        const cacheKey = getCacheKey("jobs:suggestions", { q, type: type || "title" });
        const cached = await getCache<{ suggestions: string[] }>(cacheKey);
        if (cached) {
          reply.header("X-Cache", "HIT");
          return cached;
        }

        const searchTerm = `%${q.toLowerCase()}%`;
        const limit = 10;

        if (type === "company") {
          // Get company suggestions - optimized with trigram index
          const companies = await prisma.$queryRawUnsafe<Array<{ company: string }>>(
            `SELECT DISTINCT company 
             FROM jobs 
             WHERE LOWER(company) LIKE $1 
               AND status = 'APPROVED'::"JobStatus"
             ORDER BY company 
             LIMIT $2`,
            searchTerm,
            limit
          );
          const result = { suggestions: companies.map((c) => c.company) };
          
          // Cache suggestions for 1 hour (they don't change often)
          await setCache(cacheKey, result, 3600);
          reply.header("X-Cache", "MISS");
          
          return result;
        } else {
          // Get job title suggestions - optimized with trigram index
          const titles = await prisma.$queryRawUnsafe<Array<{ title: string }>>(
            `SELECT DISTINCT title 
             FROM jobs 
             WHERE LOWER(title) LIKE $1 
               AND status = 'APPROVED'::"JobStatus"
             ORDER BY title 
             LIMIT $2`,
            searchTerm,
            limit
          );
          const result = { suggestions: titles.map((t) => t.title) };
          
          // Cache suggestions for 1 hour (they don't change often)
          await setCache(cacheKey, result, 3600);
          reply.header("X-Cache", "MISS");
          
          return result;
        }
      } catch (error) {
        fastify.log.error(error);
        if (error instanceof Error) {
          captureException(error, {
            route: "/v1/jobs/suggestions",
            method: "GET",
            query: request.query,
          });
        }
        reply.code(500).send({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );
}

