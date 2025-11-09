-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMP', 'INTERN');

-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('ADZUNA', 'USAJOBS', 'MANUAL');

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "source" "JobSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "street" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "locationPoint" geometry(Point, 4326) NOT NULL,
    "employmentType" "EmploymentType",
    "payMin" INTEGER,
    "payMax" INTEGER,
    "payCurrency" TEXT DEFAULT 'USD',
    "postedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobs_company_idx" ON "jobs"("company");

-- CreateIndex
CREATE INDEX "jobs_postedAt_idx" ON "jobs"("postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_source_sourceId_key" ON "jobs"("source", "sourceId");

