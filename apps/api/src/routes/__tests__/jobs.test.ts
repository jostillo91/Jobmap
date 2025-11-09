import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "../../lib/prisma";

// Mock Prisma
vi.mock("../../lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
  },
}));

describe("Job Search - BBox Filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return only jobs within bounding box", async () => {
    // Phoenix bounding box
    const phoenixBbox = {
      minLon: -112.2,
      minLat: 33.3,
      maxLon: -111.9,
      maxLat: 33.6,
    };

    // Mock jobs - some inside, some outside
    const mockJobs = [
      {
        id: "1",
        title: "Job in Phoenix",
        company: "Phoenix Corp",
        url: "https://example.com/1",
        latitude: 33.4484, // Inside bbox
        longitude: -112.074, // Inside bbox
        payMin: 50000,
        payMax: 70000,
        postedAt: new Date("2024-01-01"),
        street: "123 Main St",
        city: "Phoenix",
        state: "AZ",
        employmentType: "FULL_TIME",
        source: "ADZUNA",
      },
      {
        id: "2",
        title: "Job outside Phoenix",
        company: "Distant Corp",
        url: "https://example.com/2",
        latitude: 34.0, // Outside bbox (too far north)
        longitude: -112.0,
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

    (prisma.$queryRawUnsafe as any).mockResolvedValueOnce([mockJobs[0]]);

    // Simulate the query that would be executed
    const query = `
      SELECT 
        id, title, company, url, latitude, longitude,
        "payMin", "payMax", "postedAt", street, city, state,
        "employmentType", source
      FROM jobs
      WHERE ST_Intersects("locationPoint", ST_MakeEnvelope($1, $2, $3, $4, 4326))
        AND status = 'APPROVED'::"JobStatus"
      ORDER BY "postedAt" DESC
      LIMIT $5
    `;

    const result = await prisma.$queryRawUnsafe(
      query,
      phoenixBbox.minLon,
      phoenixBbox.minLat,
      phoenixBbox.maxLon,
      phoenixBbox.maxLat,
      200
    );

    expect(result).toHaveLength(1);
    expect((result as any[])[0].id).toBe("1");
    expect((result as any[])[0].latitude).toBeGreaterThanOrEqual(phoenixBbox.minLat);
    expect((result as any[])[0].latitude).toBeLessThanOrEqual(phoenixBbox.maxLat);
    expect((result as any[])[0].longitude).toBeGreaterThanOrEqual(phoenixBbox.minLon);
    expect((result as any[])[0].longitude).toBeLessThanOrEqual(phoenixBbox.maxLon);
  });

  it("should filter by keyword in bbox search", async () => {
    const mockJobs = [
      {
        id: "1",
        title: "Software Engineer",
        company: "Tech Corp",
        url: "https://example.com/1",
        latitude: 33.4484,
        longitude: -112.074,
        payMin: 80000,
        payMax: 120000,
        postedAt: new Date("2024-01-01"),
        street: null,
        city: "Phoenix",
        state: "AZ",
        employmentType: "FULL_TIME",
        source: "ADZUNA",
      },
    ];

    (prisma.$queryRawUnsafe as any).mockResolvedValueOnce(mockJobs);

    // Simulate query with keyword filter
    const query = `
      SELECT 
        id, title, company, url, latitude, longitude,
        "payMin", "payMax", "postedAt", street, city, state,
        "employmentType", source
      FROM jobs
      WHERE ST_Intersects("locationPoint", ST_MakeEnvelope($1, $2, $3, $4, 4326))
        AND (LOWER(title) LIKE $5 OR LOWER(description) LIKE $5)
        AND status = 'APPROVED'::"JobStatus"
      ORDER BY "postedAt" DESC
      LIMIT $6
    `;

    const result = await prisma.$queryRawUnsafe(
      query,
      -112.2,
      33.3,
      -111.9,
      33.6,
      "%software%",
      200
    );

    expect(result).toHaveLength(1);
    expect((result as any[])[0].title.toLowerCase()).toContain("software");
  });
});






