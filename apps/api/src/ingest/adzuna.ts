import { JobSource, EmploymentType } from "@prisma/client";
import { upsertJob, JobInput } from "../lib/jobs";
import { geocodeAddressSafe, reverseGeocode } from "../lib/geocode";

interface AdzunaJob {
  id: string;
  title: string;
  company: {
    display_name: string;
  };
  description: string;
  redirect_url: string;
  location: {
    display_name?: string;
    area?: string[];
    latitude?: number;
    longitude?: number;
  };
  category?: {
    label: string;
  };
  contract_type?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  created?: string;
}

interface AdzunaResponse {
  results: AdzunaJob[];
  count: number;
}

/**
 * Normalizes Adzuna employment type to our enum
 */
function normalizeEmploymentType(contractType?: string): EmploymentType | null {
  if (!contractType) return null;

  const normalized = contractType.toLowerCase();
  if (normalized.includes("full") || normalized.includes("permanent")) {
    return EmploymentType.FULL_TIME;
  }
  if (normalized.includes("part")) {
    return EmploymentType.PART_TIME;
  }
  if (normalized.includes("contract")) {
    return EmploymentType.CONTRACT;
  }
  if (normalized.includes("temp") || normalized.includes("temporary")) {
    return EmploymentType.TEMP;
  }
  if (normalized.includes("intern")) {
    return EmploymentType.INTERN;
  }
  return null;
}

/**
 * Converts salary to annual USD
 * Adzuna salaries are typically in the job's local currency and may be hourly/monthly/annual
 */
function normalizeSalary(
  min?: number,
  max?: number,
  currency?: string
): { payMin?: number; payMax?: number; payCurrency: string } {
  // Default to USD
  const payCurrency = currency?.toUpperCase() || "USD";

  // If no salary info, return nulls
  if (!min && !max) {
    return { payCurrency };
  }

  // Adzuna salaries are typically annual, but we'll assume annual for now
  // In production, you'd want to check the salary field for period info
  return {
    payMin: min ? Math.round(min) : undefined,
    payMax: max ? Math.round(max) : undefined,
    payCurrency,
  };
}

/**
 * Parses location string to extract address components
 */
function parseLocation(location?: { display_name?: string; area?: string[] }): {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
} {
  if (!location?.display_name) {
    return {};
  }

  const parts = location.display_name.split(",").map((p) => p.trim());
  // Simple parsing - in production, use a geocoding service
  const city = parts[0] || undefined;
  const state = parts[1]?.match(/^[A-Z]{2}/)?.[0] || undefined;

  return {
    city,
    state,
  };
}

/**
 * Normalizes an Adzuna job to our Job model
 */
async function normalizeAdzunaJob(adzunaJob: AdzunaJob): Promise<JobInput | null> {
  let latitude: number;
  let longitude: number;

  // Parse location first (needed for address extraction)
  const locationParts = parseLocation(adzunaJob.location);

  // Use coordinates if available, otherwise geocode the location
  if (adzunaJob.location?.latitude && adzunaJob.location?.longitude) {
    latitude = adzunaJob.location.latitude;
    longitude = adzunaJob.location.longitude;
  } else if (adzunaJob.location?.display_name) {
    // Geocode the location string
    const geocoded = await geocodeAddressSafe(adzunaJob.location.display_name);
    if (!geocoded) {
      return null; // Failed to geocode
    }
    latitude = geocoded.lat;
    longitude = geocoded.lon;
  } else {
    return null; // No location info at all
  }

  // Try to extract address from job description first
  let extractedStreetAddress: string | undefined;
  if (adzunaJob.description) {
    const addressPatterns = [
      /\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl|Parkway|Pkwy)[,\s]+(?:[A-Za-z\s]+,\s*)?[A-Z]{2}\s+\d{5}/i,
      /\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl|Parkway|Pkwy)[,\s]+(?:[A-Za-z\s]+,\s*)?[A-Z]{2}/i,
      /\d+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl|Parkway|Pkwy)/i,
    ];
    
    for (const pattern of addressPatterns) {
      const match = adzunaJob.description.match(pattern);
      if (match) {
        extractedStreetAddress = match[0].trim().replace(/\s+/g, " ");
        break;
      }
    }
  }
  
  // If we found an address in description, geocode it to get precise coordinates
  if (extractedStreetAddress) {
    const addressWithCity = locationParts.city && locationParts.state
      ? `${extractedStreetAddress}, ${locationParts.city}, ${locationParts.state}`
      : extractedStreetAddress;
    
    const geocodeResult = await geocodeAddressSafe(addressWithCity);
    if (geocodeResult) {
      latitude = geocodeResult.lat;
      longitude = geocodeResult.lon;
    }
  }
  
  // Reverse geocode to get street address from coordinates (if not already extracted)
  const fullAddress = extractedStreetAddress 
    ? { street: extractedStreetAddress, city: locationParts.city, state: locationParts.state, postalCode: locationParts.postalCode, country: "US" }
    : await reverseGeocode(latitude, longitude);
  
  // If reverse geocoding fails or doesn't provide street, skip this job
  if (!fullAddress || !fullAddress.street) {
    return null; // Skip jobs without street addresses
  }

  // Parse posted date
  const postedAt = adzunaJob.created
    ? new Date(adzunaJob.created)
    : new Date(); // Fallback to now if missing
  const salary = normalizeSalary(
    adzunaJob.salary_min,
    adzunaJob.salary_max,
    "USD" // Adzuna US API returns USD
  );

  return {
    source: JobSource.ADZUNA,
    sourceId: adzunaJob.id.toString(),
    title: adzunaJob.title || "Untitled Position",
    company: adzunaJob.company?.display_name || "Unknown Company",
    description: adzunaJob.description || "",
    url: adzunaJob.redirect_url || "",
    street: fullAddress.street,
    city: fullAddress.city || locationParts.city,
    state: fullAddress.state || locationParts.state,
    postalCode: fullAddress.postalCode || locationParts.postalCode,
    country: fullAddress.country || "US",
    latitude,
    longitude,
    employmentType: normalizeEmploymentType(adzunaJob.contract_type),
    payMin: salary.payMin,
    payMax: salary.payMax,
    payCurrency: salary.payCurrency,
    postedAt,
  };
}

/**
 * Fetches jobs from Adzuna API for a specific location
 */
async function fetchAdzunaJobs(keyword?: string, location = "Phoenix, AZ"): Promise<AdzunaJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    throw new Error("ADZUNA_APP_ID and ADZUNA_APP_KEY must be set in environment");
  }

  // Fetch jobs for the specified location
  const baseUrl = "https://api.adzuna.com/v1/api/jobs/us/search/1";
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: "50",
    where: location,
    sort_by: "date", // Most recent first
  });

  if (keyword) {
    params.append("what", keyword);
  } else {
    // If no keyword, search for common job types
    params.append("what", "jobs");
  }

  const url = `${baseUrl}?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Adzuna API error response:", errorText);
      throw new Error(`Adzuna API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: AdzunaResponse = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Error fetching Adzuna jobs:", error);
    throw error;
  }
}

/**
 * Ingests jobs from Adzuna API
 */
export async function ingestAdzuna(keyword?: string, location = "Phoenix, AZ"): Promise<{
  fetched: number;
  normalized: number;
  created: number;
  updated: number;
  failed: number;
}> {
  console.log(`🔍 Fetching jobs from Adzuna for ${location}...`);
  if (keyword) {
    console.log(`   Keyword: ${keyword}`);
  }

  const metrics = {
    fetched: 0,
    normalized: 0,
    created: 0,
    updated: 0,
    failed: 0,
  };

  try {
    // Fetch jobs from Adzuna
    const adzunaJobs = await fetchAdzunaJobs(keyword, location);
    metrics.fetched = adzunaJobs.length;
    console.log(`   Fetched ${adzunaJobs.length} jobs from Adzuna`);

    // Normalize and upsert each job
    for (const adzunaJob of adzunaJobs) {
      try {
        const normalized = await normalizeAdzunaJob(adzunaJob);
        if (!normalized) {
          metrics.failed++;
          console.warn(`   ⚠️  Skipped job ${adzunaJob.id}: missing or invalid location`);
          continue;
        }

        metrics.normalized++;
        const { created } = await upsertJob(normalized);

        if (created) {
          metrics.created++;
        } else {
          metrics.updated++;
        }
      } catch (error) {
        metrics.failed++;
        console.error(`   ❌ Failed to process job ${adzunaJob.id}:`, error);
      }
    }

    console.log("\n📊 Ingestion Summary:");
    console.log(`   Fetched: ${metrics.fetched}`);
    console.log(`   Normalized: ${metrics.normalized}`);
    console.log(`   Created: ${metrics.created}`);
    console.log(`   Updated: ${metrics.updated}`);
    console.log(`   Failed: ${metrics.failed}`);

    return metrics;
  } catch (error) {
    console.error("❌ Adzuna ingestion failed:", error);
    throw error;
  }
}


