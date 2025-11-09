import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { jobsRoutes } from "../jobs";
import { prisma } from "../../lib/prisma";
import { getCache } from "../../lib/redis";

// Mock dependencies
vi.mock("../../lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    job: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../../lib/redis", () => ({
  getCache: vi.fn(),
  setCache: vi.fn(),
  getCacheKey: vi.fn((prefix, params) => `${prefix}:${JSON.stringify(params)}`),
}));

vi.mock("../../lib/sentry", () => ({
  captureException: vi.fn(),
}));

describe("Jobs API Integration Tests", () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    app = Fastify();
    await app.register(jobsRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /v1/jobs/search", () => {
    it("should return jobs within bounding box", async () => {
      const mockJobs = [
        {
          id: "1",
          title: "Software Engineer",
          company: "Tech Corp",
          url: "https://example.com/1",
          latitude: 33.4484,
          longitude: -112.074,
          payMin: 50000,
          payMax: 70000,
          postedAt: new Date("2024-01-01"),
          street: "123 Main St",
          city: "Phoenix",
          state: "AZ",
          employmentType: "FULL_TIME",
          source: "ADZUNA",
        },
      ];

      (getCache as any).mockResolvedValue(null);
      (prisma.$queryRawUnsafe as any).mockResolvedValue(mockJobs);

      const response = await app.inject({
        method: "GET",
        url: "/v1/jobs/search?bbox=-112.2,33.3,-111.9,33.6",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.jobs).toHaveLength(1);
      expect(data.jobs[0].title).toBe("Software Engineer");
      expect(data.jobs[0].lat).toBe(33.4484);
      expect(data.jobs[0].lon).toBe(-112.074);
    });

    it("should filter by keyword", async () => {
      const mockJobs = [
        {
          id: "1",
          title: "Software Engineer",
          company: "Tech Corp",
          url: "https://example.com/1",
          latitude: 33.4484,
          longitude: -112.074,
          payMin: null,
          payMax: null,
          postedAt: new Date("2024-01-01"),
          street: null,
          city: null,
          state: null,
          employmentType: null,
          source: "ADZUNA",
        },
      ];

      (getCache as any).mockResolvedValue(null);
      (prisma.$queryRawUnsafe as any).mockResolvedValue(mockJobs);

      const response = await app.inject({
        method: "GET",
        url: "/v1/jobs/search?bbox=-112.2,33.3,-111.9,33.6&q=software",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.jobs).toHaveLength(1);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("LOWER(title) LIKE"),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it("should filter by company", async () => {
      const mockJobs = [
        {
          id: "1",
          title: "Software Engineer",
          company: "Tech Corp",
          url: "https://example.com/1",
          latitude: 33.4484,
          longitude: -112.074,
          payMin: null,
          payMax: null,
          postedAt: new Date("2024-01-01"),
          street: null,
          city: null,
          state: null,
          employmentType: null,
          source: "ADZUNA",
        },
      ];

      (getCache as any).mockResolvedValue(null);
      (prisma.$queryRawUnsafe as any).mockResolvedValue(mockJobs);

      const response = await app.inject({
        method: "GET",
        url: "/v1/jobs/search?bbox=-112.2,33.3,-111.9,33.6&company=tech",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.jobs).toHaveLength(1);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("LOWER(company) LIKE"),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it("should filter by minimum pay", async () => {
      const mockJobs = [
        {
          id: "1",
          title: "Software Engineer",
          company: "Tech Corp",
          url: "https://example.com/1",
          latitude: 33.4484,
          longitude: -112.074,
          payMin: 80000,
          payMax: 100000,
          postedAt: new Date("2024-01-01"),
          street: null,
          city: null,
          state: null,
          employmentType: null,
          source: "ADZUNA",
        },
      ];

      (getCache as any).mockResolvedValue(null);
      (prisma.$queryRawUnsafe as any).mockResolvedValue(mockJobs);

      const response = await app.inject({
        method: "GET",
        url: "/v1/jobs/search?bbox=-112.2,33.3,-111.9,33.6&minPay=50000",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.jobs).toHaveLength(1);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('"payMax" >='),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it("should filter by employment types", async () => {
      const mockJobs = [
        {
          id: "1",
          title: "Software Engineer",
          company: "Tech Corp",
          url: "https://example.com/1",
          latitude: 33.4484,
          longitude: -112.074,
          payMin: null,
          payMax: null,
          postedAt: new Date("2024-01-01"),
          street: null,
          city: null,
          state: null,
          employmentType: "FULL_TIME",
          source: "ADZUNA",
        },
      ];

      (getCache as any).mockResolvedValue(null);
      (prisma.$queryRawUnsafe as any).mockResolvedValue(mockJobs);

      const response = await app.inject({
        method: "GET",
        url: "/v1/jobs/search?bbox=-112.2,33.3,-111.9,33.6&types=FULL_TIME,PART_TIME",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.jobs).toHaveLength(1);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('"employmentType" ='),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it("should use cache when available", async () => {
      const cachedData = {
        jobs: [
          {
            id: "1",
            title: "Cached Job",
            company: "Cached Corp",
            url: "https://example.com/1",
            lat: 33.4484,
            lon: -112.074,
            postedAt: "2024-01-01T00:00:00.000Z",
            source: "ADZUNA",
          },
        ],
        count: 1,
      };

      (getCache as any).mockResolvedValue(cachedData);

      const response = await app.inject({
        method: "GET",
        url: "/v1/jobs/search?bbox=-112.2,33.3,-111.9,33.6",
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["x-cache"]).toBe("HIT");
      const data = JSON.parse(response.body);
      expect(data.jobs).toHaveLength(1);
      expect(data.jobs[0].title).toBe("Cached Job");
      expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it("should return 400 for invalid bbox format", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/jobs/search?bbox=invalid",
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe("Invalid query parameters");
    });

    it("should respect limit parameter", async () => {
      const mockJobs = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        title: `Job ${i}`,
        company: "Tech Corp",
        url: `https://example.com/${i}`,
        latitude: 33.4484,
        longitude: -112.074,
        payMin: null,
        payMax: null,
        postedAt: new Date("2024-01-01"),
        street: null,
        city: null,
        state: null,
        employmentType: null,
        source: "ADZUNA",
      }));

      (getCache as any).mockResolvedValue(null);
      (prisma.$queryRawUnsafe as any).mockResolvedValue(mockJobs.slice(0, 5));

      const response = await app.inject({
        method: "GET",
        url: "/v1/jobs/search?bbox=-112.2,33.3,-111.9,33.6&limit=5",
      });

      expect(response.statusCode).toBe(200);
      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        5
      );
    });
  });

  describe("GET /v1/jobs/:id", () => {
    it("should return job details", async () => {
      const mockJob = {
        id: "test-job-1",
        source: "ADZUNA",
        sourceId: "123",
        title: "Software Engineer",
        company: "Tech Corp",
        description: "Great job opportunity",
        url: "https://example.com/job",
        street: "123 Main St",
        city: "Phoenix",
        state: "AZ",
        postalCode: "85001",
        country: "US",
        latitude: 33.4484,
        longitude: -112.074,
        employmentType: "FULL_TIME",
        payMin: 50000,
        payMax: 70000,
        payCurrency: "USD",
        postedAt: new Date("2024-01-01"),
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      (prisma.$queryRawUnsafe as any).mockResolvedValue([mockJob]);

      const response = await app.inject({
        method: "GET",
        url: "/v1/jobs/test-job-1",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.id).toBe("test-job-1");
      expect(data.title).toBe("Software Engineer");
      expect(data.company).toBe("Tech Corp");
    });

    it("should return 404 for non-existent job", async () => {
      (prisma.$queryRawUnsafe as any).mockResolvedValue([]);

      const response = await app.inject({
        method: "GET",
        url: "/v1/jobs/non-existent",
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.body);
      expect(data.error).toBe("Job not found");
    });
  });

  describe("GET /v1/jobs/suggestions", () => {
    it("should return job title suggestions", async () => {
      const mockTitles = [
        { title: "Software Engineer" },
        { title: "Software Developer" },
        { title: "Software Architect" },
      ];

      (getCache as any).mockResolvedValue(null);
      (prisma.$queryRawUnsafe as any).mockResolvedValue(mockTitles);

      const response = await app.inject({
        method: "GET",
        url: "/v1/jobs/suggestions?q=software",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.suggestions).toHaveLength(3);
      expect(data.suggestions[0]).toBe("Software Engineer");
    });

    it("should return company suggestions", async () => {
      const mockCompanies = [
        { company: "Tech Corp" },
        { company: "Tech Solutions" },
      ];

      (getCache as any).mockResolvedValue(null);
      (prisma.$queryRawUnsafe as any).mockResolvedValue(mockCompanies);

      const response = await app.inject({
        method: "GET",
        url: "/v1/jobs/suggestions?q=tech&type=company",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.suggestions).toHaveLength(2);
      expect(data.suggestions[0]).toBe("Tech Corp");
    });

    it("should return empty array for short query", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/jobs/suggestions?q=a",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.suggestions).toEqual([]);
      expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });
  });
});


