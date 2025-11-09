import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { JobStatus } from "@prisma/client";
import { JobPin } from "../types/jobs";
import { captureException } from "../lib/sentry";

// Admin key validation
function validateAdminKey(request: any): boolean {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    return false; // No admin key set = no admin access
  }

  const providedKey = request.headers["x-admin-key"];
  return providedKey === adminKey;
}

// Convert job to pin format
function jobToPin(job: any): JobPin {
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

const jobIdSchema = z.object({
  id: z.string(),
});

const listJobsQuerySchema = z.object({
  status: z.nativeEnum(JobStatus).optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
});

/**
 * Registers admin routes
 */
export async function adminRoutes(fastify: FastifyInstance) {
  // Middleware to check admin key
  fastify.addHook("onRequest", async (request, reply) => {
    if (!validateAdminKey(request)) {
      reply.code(401).send({
        error: "Unauthorized",
        message: "Invalid or missing admin key",
      });
      return;
    }
  });

  // List jobs (with optional status filter)
  fastify.get<{ Querystring: z.infer<typeof listJobsQuerySchema> }>(
    "/v1/admin/jobs",
    async (request, reply) => {
      try {
        const params = listJobsQuerySchema.parse(request.query);

        const where: any = {};
        if (params.status) {
          where.status = params.status;
        }

        const [jobs, total] = await Promise.all([
          prisma.job.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: params.limit,
            skip: params.offset,
          }),
          prisma.job.count({ where }),
        ]);

        return {
          jobs: jobs.map(jobToPin),
          total,
          limit: params.limit,
          offset: params.offset,
        };
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
            route: request.url,
            method: request.method,
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

  // Approve a job
  fastify.post<{ Params: z.infer<typeof jobIdSchema> }>(
    "/v1/admin/jobs/:id/approve",
    async (request, reply) => {
      try {
        const { id } = jobIdSchema.parse(request.params);

        const job = await prisma.job.findUnique({
          where: { id },
        });

        if (!job) {
          reply.code(404).send({
            error: "Job not found",
          });
          return;
        }

        const updated = await prisma.job.update({
          where: { id },
          data: { status: JobStatus.APPROVED },
        });

        return {
          success: true,
          job: jobToPin(updated),
          message: "Job approved successfully",
        };
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
            route: request.url,
            method: request.method,
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

  // Reject a job
  fastify.post<{ Params: z.infer<typeof jobIdSchema> }>(
    "/v1/admin/jobs/:id/reject",
    async (request, reply) => {
      try {
        const { id } = jobIdSchema.parse(request.params);

        const job = await prisma.job.findUnique({
          where: { id },
        });

        if (!job) {
          reply.code(404).send({
            error: "Job not found",
          });
          return;
        }

        const updated = await prisma.job.update({
          where: { id },
          data: { status: JobStatus.REJECTED },
        });

        return {
          success: true,
          job: jobToPin(updated),
          message: "Job rejected successfully",
        };
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
            route: request.url,
            method: request.method,
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

  // Trigger job ingestion
  fastify.post<{ Body: { location?: string; keyword?: string; sources?: string[] } }>(
    "/v1/admin/ingest",
    async (request, reply) => {
      try {
        const { location, keyword, sources } = request.body || {};

        // Import ingestion functions dynamically to avoid loading Puppeteer unless needed
        const { ingestAll } = await import("../ingest/index");
        const { ingestLinkedIn } = await import("../ingest/linkedin");
        const { ingestIndeed } = await import("../ingest/indeed");
        const { ingestZipRecruiter } = await import("../ingest/ziprecruiter");

        // If specific sources are requested, run only those
        if (sources && sources.length > 0) {
          const results: Record<string, any> = {};
          const searchLocation = location || "Phoenix, AZ";

          for (const source of sources) {
            try {
              if (source.toLowerCase() === "linkedin") {
                results.linkedin = await ingestLinkedIn(searchLocation, keyword);
              } else if (source.toLowerCase() === "indeed") {
                results.indeed = await ingestIndeed(searchLocation, keyword);
              } else if (source.toLowerCase() === "ziprecruiter") {
                results.ziprecruiter = await ingestZipRecruiter(searchLocation, keyword);
              }
            } catch (error) {
              fastify.log.error(`Ingestion failed for ${source}:`, error);
              results[source] = { error: error instanceof Error ? error.message : "Unknown error" };
            }
          }

          return {
            success: true,
            results,
            message: "Ingestion completed for specified sources",
          };
        }

        // Otherwise, run all sources
        await ingestAll(location, keyword);

        return {
          success: true,
          message: "Job ingestion started. Check logs for details.",
        };
      } catch (error) {
        fastify.log.error(error);
        if (error instanceof Error) {
          captureException(error, {
            route: "/v1/admin/ingest",
            method: "POST",
            body: request.body,
          });
        }
        reply.code(500).send({
          error: "Internal server error",
          message: "Failed to trigger job ingestion",
        });
      }
    }
  );
}

