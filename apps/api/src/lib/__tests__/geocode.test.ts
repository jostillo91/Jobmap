import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing
const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();

vi.mock("../prisma", () => ({
  prisma: {
    geocodeCache: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  },
}));

import { geocodeAddress, geocodeAddressSafe } from "../geocode";

// Mock fetch globally
global.fetch = vi.fn();

describe("Geocoding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MAPBOX_TOKEN = "test-token";
  });

  it("should cache geocoding results", async () => {
    const address = {
      street: "123 Main St",
      city: "Phoenix",
      state: "AZ",
      postalCode: "85001",
      country: "US",
    };

    // First call - cache miss, should call API
    mockFindUnique.mockResolvedValueOnce(null);
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            center: [-112.074, 33.4484], // [lon, lat]
          },
        ],
      }),
    });
    mockUpsert.mockResolvedValueOnce({
      key: "123 main st, phoenix, az, 85001, us",
      lat: 33.4484,
      lon: -112.074,
    });

    const result1 = await geocodeAddress(address);

    expect(result1.lat).toBe(33.4484);
    expect(result1.lon).toBe(-112.074);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalled();

    // Second call - cache hit, should not call API
    mockFindUnique.mockResolvedValueOnce({
      key: "123 main st, phoenix, az, 85001, us",
      lat: 33.4484,
      lon: -112.074,
    });

    const result2 = await geocodeAddress(address);

    expect(result2.lat).toBe(33.4484);
    expect(result2.lon).toBe(-112.074);
    // Fetch should not be called again (still 1 call total)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should return null on geocoding failure (safe version)", async () => {
    const address = {
      street: "Invalid Address 99999",
      city: "Nowhere",
      state: "XX",
      country: "US",
    };

    mockFindUnique.mockResolvedValueOnce(null);
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [], // No results
      }),
    });

    const result = await geocodeAddressSafe(address);

    expect(result).toBeNull();
  });
});
