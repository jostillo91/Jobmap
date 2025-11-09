import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing
vi.mock("../prisma", () => ({
  prisma: {
    geocodeCache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { geocodeAddress, geocodeAddressSafe } from "../geocode";
import { prisma } from "../prisma";

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
    (prisma.geocodeCache.findUnique as any).mockResolvedValueOnce(null);
    // Mock proximity bias fetch (city lookup)
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
    // Mock main geocode fetch
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
    (prisma.geocodeCache.upsert as any).mockResolvedValueOnce({
      key: "123 main st, phoenix, az, 85001, us",
      lat: 33.4484,
      lon: -112.074,
    });

    const result1 = await geocodeAddress(address);

    expect(result1.lat).toBe(33.4484);
    expect(result1.lon).toBe(-112.074);
    expect(global.fetch).toHaveBeenCalledTimes(2); // Proximity bias + main geocode
    expect(prisma.geocodeCache.upsert).toHaveBeenCalled();

    // Second call - cache hit, should not call API
    // Reset fetch mock call count
    (global.fetch as any).mockClear();
    (prisma.geocodeCache.findUnique as any).mockResolvedValueOnce({
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

    (prisma.geocodeCache.findUnique as any).mockResolvedValueOnce(null);
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
