-- CreateTable
CREATE TABLE "geocode_cache" (
    "key" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geocode_cache_pkey" PRIMARY KEY ("key")
);






