import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing
vi.mock("../../lib/jobs", () => ({
  upsertJob: vi.fn(),
}));

vi.mock("../../lib/geocode", () => ({
  geocodeAddressSafe: vi.fn(),
  reverseGeocode: vi.fn(),
}));

import { ingestAdzuna } from "../adzuna";
import { upsertJob } from "../../lib/jobs";
import { reverseGeocode } from "../../lib/geocode";

// Mock fetch globally
global.fetch = vi.fn();

describe("Adzuna Ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADZUNA_APP_ID = "test-id";
    process.env.ADZUNA_APP_KEY = "test-key";
  });

  it("should normalize and upsert Adzuna jobs", async () => {
    const mockAdzunaResponse = {
      results: [
        {
          id: "123",
          title: "Software Engineer",
          company: { display_name: "Tech Corp" },
          description: "Great job opportunity",
          redirect_url: "https://example.com/job/123",
          location: {
            display_name: "Phoenix, AZ",
            latitude: 33.4484,
            longitude: -112.074,
          },
          contract_type: "full_time",
          salary_min: 80000,
          salary_max: 120000,
          created: "2024-01-01T00:00:00Z",
        },
      ],
      count: 1,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAdzunaResponse,
    });

    (reverseGeocode as any).mockResolvedValue({
      street: "123 Main St",
      city: "Phoenix",
      state: "AZ",
      postalCode: "85001",
      country: "US",
    });

    (upsertJob as any).mockResolvedValue({ job: { id: "job-1" }, created: true });

    const result = await ingestAdzuna();

    expect(result.fetched).toBe(1);
    expect(result.normalized).toBe(1);
    expect(result.created).toBe(1);
    expect(upsertJob).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "ADZUNA",
        sourceId: "123",
        title: "Software Engineer",
        company: "Tech Corp",
        latitude: 33.4484,
        longitude: -112.074,
      })
    );
  });

  it("should skip jobs without coordinates", async () => {
    const mockAdzunaResponse = {
      results: [
        {
          id: "123",
          title: "Software Engineer",
          company: { display_name: "Tech Corp" },
          description: "Great job opportunity",
          redirect_url: "https://example.com/job/123",
          location: {
            display_name: "Phoenix, AZ",
            // Missing latitude/longitude
          },
        },
      ],
      count: 1,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAdzunaResponse,
    });

    const result = await ingestAdzuna();

    expect(result.fetched).toBe(1);
    expect(result.normalized).toBe(0);
    expect(result.failed).toBe(1);
    expect(upsertJob).not.toHaveBeenCalled();
  });

  it("should handle duplicate jobs (upsert)", async () => {
    const mockAdzunaResponse = {
      results: [
        {
          id: "123",
          title: "Software Engineer",
          company: { display_name: "Tech Corp" },
          description: "Great job opportunity",
          redirect_url: "https://example.com/job/123",
          location: {
            latitude: 33.4484,
            longitude: -112.074,
          },
          created: "2024-01-01T00:00:00Z",
        },
      ],
      count: 1,
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAdzunaResponse,
    });

    (reverseGeocode as any).mockResolvedValue({
      street: "123 Main St",
      city: "Phoenix",
      state: "AZ",
      postalCode: "85001",
      country: "US",
    });

    (upsertJob as any).mockResolvedValue({ job: { id: "job-1" }, created: false });

    const result = await ingestAdzuna();

    expect(result.updated).toBe(1);
    expect(result.created).toBe(0);
  });
});

