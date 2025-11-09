-- Add spatial index on locationPoint for faster PostGIS queries
CREATE INDEX IF NOT EXISTS "jobs_locationPoint_idx" ON "jobs" USING GIST ("locationPoint");

-- Composite index for common filter combinations
-- Status + PostedAt (most queries filter by status and order by postedAt)
CREATE INDEX IF NOT EXISTS "jobs_status_postedAt_idx" ON "jobs"("status", "postedAt" DESC);

-- Composite index for employment type + status
CREATE INDEX IF NOT EXISTS "jobs_employmentType_status_idx" ON "jobs"("employmentType", "status");

-- Index for pay range queries
CREATE INDEX IF NOT EXISTS "jobs_payMin_payMax_idx" ON "jobs"("payMin", "payMax") WHERE "payMin" IS NOT NULL OR "payMax" IS NOT NULL;

-- Text search index for title (using pg_trgm for better LIKE performance)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "jobs_title_trgm_idx" ON "jobs" USING GIN (LOWER("title") gin_trgm_ops);

-- Text search index for company
CREATE INDEX IF NOT EXISTS "jobs_company_trgm_idx" ON "jobs" USING GIN (LOWER("company") gin_trgm_ops);


