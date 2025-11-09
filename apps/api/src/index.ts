import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import dotenv from "dotenv";
import { join } from "path";
import { jobsRoutes } from "./routes/jobs";
import { employerRoutes } from "./routes/employer";
import { adminRoutes } from "./routes/admin";
import { initSentry, captureException } from "./lib/sentry";
import { initRedis } from "./lib/redis";

// Load .env from project root or apps/api directory
const rootEnv = join(process.cwd(), "../../.env");
const apiEnv = join(process.cwd(), ".env");
dotenv.config({ path: rootEnv });
dotenv.config({ path: apiEnv });

const fastify = Fastify({
  logger: true,
});

async function start() {
  // Initialize Sentry before anything else
  initSentry();
  
  // Initialize Redis (optional - app works without it)
  initRedis();

  try {
    await fastify.register(cors, {
      origin: process.env.WEB_ORIGIN || "http://localhost:3000",
    });

    // Add security headers
    fastify.addHook("onSend", async (request, reply) => {
      reply.header("X-Content-Type-Options", "nosniff");
      reply.header("X-Frame-Options", "DENY");
      reply.header("X-XSS-Protection", "1; mode=block");
      reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
      reply.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
      
      // Only add HSTS in production with HTTPS
      if (process.env.NODE_ENV === "production") {
        reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
      }
    });

    // Health check
    fastify.get("/health", async () => {
      return { status: "ok" };
    });

    // Register rate limiting
    await fastify.register(rateLimit, {
      max: 100, // Global rate limit
      timeWindow: "1 minute",
    });

    // Register job routes
    await fastify.register(jobsRoutes);

    // Register employer routes
    await fastify.register(employerRoutes);

    // Register admin routes
    await fastify.register(adminRoutes);

    const port = Number(process.env.PORT) || 4000;
    await fastify.listen({ port, host: "0.0.0.0" });
    console.log(`🚀 API server running on http://0.0.0.0:${port}`);
  } catch (err) {
    fastify.log.error(err);
    if (err instanceof Error) {
      captureException(err, { context: "server_startup" });
    }
    process.exit(1);
  }
}

start();

