-- AlterEnum
-- This migration adds LINKEDIN, INDEED, and ZIPRECRUITER to the JobSource enum
DO $$ BEGIN
 CREATE TYPE "JobSource_new" AS ENUM('ADZUNA', 'USAJOBS', 'MANUAL', 'LINKEDIN', 'INDEED', 'ZIPRECRUITER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- Update the column to use the new enum type
ALTER TABLE "jobs" ALTER COLUMN "source" TYPE "JobSource_new" USING ("source"::text::"JobSource_new");

-- Drop the old enum type
DROP TYPE "JobSource";

-- Rename the new enum type to the original name
ALTER TYPE "JobSource_new" RENAME TO "JobSource";

