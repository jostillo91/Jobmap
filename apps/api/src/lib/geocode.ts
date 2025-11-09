import { prisma } from "./prisma";

export interface GeocodeAddress {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string;
}

export interface GeocodeResult {
  lat: number;
  lon: number;
}

/**
 * Normalizes an address to a cache key
 */
function normalizeAddressKey(address: GeocodeAddress): string {
  const parts = [
    address.street,
    address.city,
    address.state,
    address.postalCode,
    address.country || "US",
  ]
    .filter((p) => p)
    .map((p) => p!.toLowerCase().trim())
    .join(", ");

  return parts;
}

/**
 * Geocodes an address using Mapbox Geocoding API
 */
async function geocodeWithMapbox(address: GeocodeAddress): Promise<GeocodeResult> {
  const token = process.env.MAPBOX_TOKEN;

  if (!token) {
    throw new Error("MAPBOX_TOKEN must be set in environment");
  }

  // Build query string
  const queryParts: string[] = [];
  if (address.street) queryParts.push(address.street);
  if (address.city) queryParts.push(address.city);
  if (address.state) queryParts.push(address.state);
  if (address.postalCode) queryParts.push(address.postalCode);
  if (address.country) queryParts.push(address.country);

  const query = queryParts.join(", ");
  if (!query) {
    throw new Error("Address must have at least one component");
  }

  // Mapbox Geocoding API endpoint
  // Use proximity bias and country code for better accuracy
  const baseUrl = "https://api.mapbox.com/geocoding/v5/mapbox.places";
  const encodedQuery = encodeURIComponent(query);
  const params = new URLSearchParams({
    access_token: token,
    limit: "1",
    types: "address,poi", // Prioritize specific addresses and POIs
    country: address.country || "US", // Limit to specific country for better accuracy
  });
  
  // Add proximity bias if we have city/state info (helps with disambiguation)
  if (address.city && address.state) {
    // Try to get approximate coordinates for the city to bias results
    const cityQuery = `${address.city}, ${address.state}`;
    try {
      const cityUrl = `${baseUrl}/${encodeURIComponent(cityQuery)}.json?access_token=${token}&limit=1&types=place`;
      const cityResponse = await fetch(cityUrl);
      if (cityResponse.ok) {
        const cityData = await cityResponse.json() as { features?: Array<{ center?: [number, number] }> };
        if (cityData.features?.[0]?.center) {
          const [cityLon, cityLat] = cityData.features[0].center;
          params.append("proximity", `${cityLon},${cityLat}`);
        }
      }
    } catch (e) {
      // Ignore proximity bias errors, continue without it
    }
  }
  
  const url = `${baseUrl}/${encodedQuery}.json?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { features?: Array<{ center: [number, number] }> };

    if (!data.features || data.features.length === 0) {
      throw new Error("No results found for address");
    }

    const feature = data.features[0];
    const [lon, lat] = feature.center; // Mapbox returns [longitude, latitude]
    
    // Check accuracy if available (Mapbox provides this in some responses)
    // Higher accuracy means more precise location
    const accuracy = feature.properties?.accuracy;
    if (accuracy && accuracy === "low") {
      console.warn(`Low accuracy geocoding result for: ${query}`);
    }

    return { lat, lon };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown error during geocoding");
  }
}

/**
 * Geocodes an address, using cache if available
 * Returns coordinates or throws an error if geocoding fails
 */
export async function geocodeAddress(
  address: GeocodeAddress
): Promise<GeocodeResult> {
  // Check cache first
  const cacheKey = normalizeAddressKey(address);

  try {
    const cached = await prisma.geocodeCache.findUnique({
      where: { key: cacheKey },
    });

    if (cached) {
      return { lat: cached.lat, lon: cached.lon };
    }
  } catch (error) {
    // If cache lookup fails, continue to geocode
    console.warn("Cache lookup failed, proceeding with geocoding:", error);
  }

  // Geocode using Mapbox
  const result = await geocodeWithMapbox(address);

  // Cache the result (don't fail if caching fails)
  try {
    await prisma.geocodeCache.upsert({
      where: { key: cacheKey },
      create: {
        key: cacheKey,
        lat: result.lat,
        lon: result.lon,
      },
      update: {
        lat: result.lat,
        lon: result.lon,
      },
    });
  } catch (error) {
    // Log but don't throw - caching failure shouldn't break geocoding
    console.warn("Failed to cache geocode result:", error);
  }

  return result;
}

/**
 * Reverse geocodes coordinates to get a full address including street
 * Returns null if coordinates appear to be city-level (imprecise) rather than specific addresses
 */
export async function reverseGeocode(lat: number, lon: number, options?: {
  allowImprecise?: boolean; // If true, allows city-level coordinates
}): Promise<GeocodeAddress | null> {
  const token = process.env.MAPBOX_TOKEN;

  if (!token) {
    throw new Error("MAPBOX_TOKEN must be set in environment");
  }

  const baseUrl = "https://api.mapbox.com/geocoding/v5/mapbox.places";
  // Use poi (point of interest) type first, then fallback to address
  // Request multiple results to pick the most accurate one
  const url = `${baseUrl}/${lon},${lat}.json?access_token=${token}&types=poi,address&limit=5`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as { features?: Array<{ place_type?: string[]; context?: Array<{ id?: string; text?: string; short_code?: string }>; properties?: { address?: string; city?: string; state?: string; postcode?: string; country?: string } }> };

    if (!data.features || data.features.length === 0) {
      return null;
    }

    // Find the most precise result (prefer POI, then address, then others)
    let feature = data.features[0];
    let bestPrecision = 0;
    
    for (const f of data.features) {
      const featureType = f.place_type?.[0];
      let precision = 0;
      
      // POIs are most precise (actual business locations)
      if (featureType === 'poi') precision = 3;
      // Specific addresses are next most precise
      else if (featureType === 'address') precision = 2;
      // Street intersections are less precise
      else if (featureType === 'street') precision = 1;
      // Everything else (city, region) is not precise
      else precision = 0;
      
      if (precision > bestPrecision) {
        bestPrecision = precision;
        feature = f;
      }
    }
    
    const context = feature.context || [];
    
    // Check if this is a precise location (POI or specific address) vs city center
    const featureType = feature.place_type?.[0];
    const isPreciseLocation = featureType === 'poi' || featureType === 'address';
    
    // If coordinates point to city center and we don't allow imprecise, return null
    if (!options?.allowImprecise && !isPreciseLocation) {
      // Check if the result is just a city or region (not a specific address)
      const isCityLevel = featureType === 'place' || featureType === 'region';
      if (isCityLevel) {
        return null; // This is city-level, not a specific address
      }
    }
    
    // Extract address components from Mapbox response
    let street: string | undefined;
    let city: string | undefined;
    let state: string | undefined;
    let postalCode: string | undefined;
    let country = "US";

    // For POIs, use the POI name + address if available
    if (featureType === 'poi' && feature.properties?.name) {
      // Try to get the street address from properties
      if (feature.properties.address) {
        street = `${feature.properties.address} ${feature.properties.name}`.trim();
      } else {
        street = feature.properties.name;
      }
    } else if (feature.properties?.address) {
      street = `${feature.properties.address} ${feature.text}`.trim();
    } else if (feature.text) {
      street = feature.text;
    }

    // Extract city, state, postal code from context
    for (const item of context) {
      const id = item.id?.split(".")[0];
      if (id === "place" && !city) {
        city = item.text;
      } else if (id === "region") {
        state = item.short_code?.replace("US-", "") || item.text;
      } else if (id === "postcode") {
        postalCode = item.text;
      } else if (id === "country") {
        country = item.short_code || "US";
      }
    }

    // If we don't have a street address, return null (unless allowImprecise is true)
    if (!street && !options?.allowImprecise) {
      return null;
    }

    return {
      street: street || undefined,
      city: city || undefined,
      state: state || undefined,
      postalCode: postalCode || undefined,
      country,
    };
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return null;
  }
}

/**
 * Geocodes an address with error handling
 * Returns null if geocoding fails (doesn't throw)
 * Accepts either a GeocodeAddress object or a string
 */
export async function geocodeAddressSafe(
  address: GeocodeAddress | string
): Promise<GeocodeResult | null> {
  try {
    // If address is a string, convert it to GeocodeAddress object
    let addressObj: GeocodeAddress;
    if (typeof address === "string") {
      // Parse the string - assume it's "City, State" or similar format
      const parts = address.split(",").map((p) => p.trim());
      addressObj = {
        city: parts[0] || undefined,
        state: parts[1] || undefined,
        country: "US",
      };
    } else {
      addressObj = address;
    }
    
    return await geocodeAddress(addressObj);
  } catch (error) {
    console.error("Geocoding failed for address:", address, error);
    return null;
  }
}


