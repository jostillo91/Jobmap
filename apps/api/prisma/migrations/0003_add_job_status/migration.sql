-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED');

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "status" "JobStatus" NOT NULL DEFAULT 'APPROVED';

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");






