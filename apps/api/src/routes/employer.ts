import { FastifyInstance } from "fastify";
import { z } from "zod";
import { JobSource, EmploymentType } from "@prisma/client";
import { upsertJob } from "../lib/jobs";
import { geocodeAddressSafe } from "../lib/geocode";
import { captureException } from "../lib/sentry";

// Rate limiting storage (in-memory, simple implementation)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // 5 submissions per hour per IP

function getClientIP(request: any): string {
  return (
    request.headers["x-forwarded-for"]?.split(",")[0] ||
    request.headers["x-real-ip"] ||
    request.socket.remoteAddress ||
    "unknown"
  );
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetAt) {
    // New window or expired
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  rateLimitStore.set(ip, record);
  return { allowed: true, remaining: RATE_LIMIT_MAX - record.count };
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Employer post schema
const employerPostSchema = z.object({
  company: z.string().min(1, "Company name is required").max(200),
  title: z.string().min(1, "Job title is required").max(200),
  description: z.string().min(10, "Description must be at least 10 characters").max(5000),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  payMin: z.number().int().positive().optional(),
  payMax: z.number().int().positive().optional(),
  url: z.string().url("Must be a valid URL"),
  street: z.string().min(1, "Street address is required").max(200),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(2, "State is required").max(2),
  postalCode: z.string().min(5, "Postal code is required").max(10),
  country: z.string().default("US"),
  hCaptcha: z.string().optional(), // Mock for now - just check it exists
});

// Address validation schema
const addressValidationSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(2).max(2),
  postalCode: z.string().min(5),
  country: z.string().default("US"),
});

/**
 * Registers employer routes
 */
export async function employerRoutes(fastify: FastifyInstance) {
  // Validate address (for preview)
  fastify.post<{ Body: z.infer<typeof addressValidationSchema> }>(
    "/v1/employer/validate-address",
    async (request, reply) => {
      try {
        const body = addressValidationSchema.parse(request.body);

        const geocodeResult = await geocodeAddressSafe({
          street: body.street,
          city: body.city,
          state: body.state,
          postalCode: body.postalCode,
          country: body.country,
        });

        if (!geocodeResult) {
          reply.code(422).send({
            error: "Address geocoding failed",
            message: "Could not find coordinates for this address",
          });
          return;
        }

        return {
          lat: geocodeResult.lat,
          lon: geocodeResult.lon,
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          reply.code(400).send({
            error: "Validation error",
            details: error.errors,
          });
          return;
        }

        fastify.log.error(error);
        reply.code(500).send({
          error: "Internal server error",
        });
      }
    }
  );

  // Post a new job listing
  fastify.post<{ Body: z.infer<typeof employerPostSchema> }>(
    "/v1/employer/post",
    async (request, reply) => {
      try {
        // Rate limiting
        const ip = getClientIP(request);
        const rateLimit = checkRateLimit(ip);

        if (!rateLimit.allowed) {
          reply.code(429).send({
            error: "Rate limit exceeded",
            message: `You can submit up to ${RATE_LIMIT_MAX} jobs per hour. Please try again later.`,
            retryAfter: Math.ceil(
              ((rateLimitStore.get(ip)?.resetAt || 0) - Date.now()) / 1000
            ),
          });
          return;
        }

        // Validate request body
        const body = employerPostSchema.parse(request.body);

        // Mock hCaptcha validation (just check it exists)
        if (!body.hCaptcha) {
          reply.code(400).send({
            error: "hCaptcha verification required",
            message: "Please complete the hCaptcha verification",
          });
          return;
        }

        // Geocode the address
        const geocodeResult = await geocodeAddressSafe({
          street: body.street,
          city: body.city,
          state: body.state,
          postalCode: body.postalCode,
          country: body.country,
        });

        if (!geocodeResult) {
          reply.code(422).send({
            error: "Address geocoding failed",
            message:
              "We couldn't find coordinates for this address. Please verify the address is correct and try again.",
          });
          return;
        }

        // Generate sourceId (cuid-like)
        const generateId = () => {
          const timestamp = Date.now().toString(36);
          const randomPart = Math.random().toString(36).substring(2, 15);
          return `manual-${timestamp}${randomPart}`;
        };

        // Create job
        const { job } = await upsertJob({
          source: JobSource.MANUAL,
          sourceId: generateId(),
          title: body.title,
          company: body.company,
          description: body.description,
          url: body.url,
          street: body.street,
          city: body.city,
          state: body.state,
          postalCode: body.postalCode,
          country: body.country,
          latitude: geocodeResult.lat,
          longitude: geocodeResult.lon,
          employmentType: body.employmentType || null,
          payMin: body.payMin || null,
          payMax: body.payMax || null,
          payCurrency: "USD",
          postedAt: new Date(),
        });

        return {
          success: true,
          job: {
            id: job.id,
            title: job.title,
            company: job.company,
            latitude: job.latitude,
            longitude: job.longitude,
          },
          message: "Job posted successfully! It will appear on the map after moderation.",
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          reply.code(400).send({
            error: "Validation error",
            details: error.errors,
          });
          return;
        }

        fastify.log.error(error);
        if (error instanceof Error) {
          captureException(error, {
            route: "/v1/employer/post",
            method: "POST",
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
