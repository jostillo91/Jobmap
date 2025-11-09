import { JobSource, EmploymentType } from "@prisma/client";
import { upsertJob, JobInput } from "../lib/jobs";
import { reverseGeocode } from "../lib/geocode";

interface USAJobsLocation {
  LocationName?: string;
  Country?: string;
  CountrySubDivisionCode?: string; // State code
  CityName?: string;
  Longitude?: number;
  Latitude?: number;
  LocationDisplay?: string;
}

interface USAJobsPositionRemuneration {
  MinimumRange?: string;
  MaximumRange?: string;
  RateIntervalCode?: string; // "Per Year", "Per Hour", etc.
}

interface USAJobsPositionSchedule {
  Name?: string; // "Full-time", "Part-time", etc.
}

interface USAJobsSearchResult {
  MatchedObjectId: string;
  MatchedObjectDescriptor: {
    PositionID: string;
    PositionTitle: string;
    OrganizationName: string;
    PositionURI: string;
    ApplyURI: string[];
    PositionRemuneration?: USAJobsPositionRemuneration[];
    PositionSchedule?: USAJobsPositionSchedule[];
    PositionLocationDisplay?: string;
    PositionLocation?: USAJobsLocation[];
    PositionFormattedDescription?: Array<{
      Content: string;
    }>;
    PositionStartDate: string;
    PositionEndDate: string;
  };
}

interface USAJobsResponse {
  SearchResult: {
    SearchResultItems: USAJobsSearchResult[];
    SearchResultCount: number;
  };
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches from USAJOBS API with retry and backoff
 */
async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers });

      // Rate limit handling (429 Too Many Requests)
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, attempt);
        console.log(`   ⏳ Rate limited. Waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}`);
        await sleep(delay);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`USAJOBS API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        throw error;
      }
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`   ⚠️  Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(delay);
    }
  }
  throw new Error("Max retries exceeded");
}

/**
 * Normalizes USAJOBS employment type to our enum
 */
function normalizeEmploymentType(schedule?: string): EmploymentType | null {
  if (!schedule) return null;

  const normalized = schedule.toLowerCase();
  if (normalized.includes("full")) {
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
 * Converts USAJOBS salary to annual USD
 */
function normalizeSalary(
  remuneration?: USAJobsPositionRemuneration[]
): { payMin?: number; payMax?: number; payCurrency: string } {
  if (!remuneration || remuneration.length === 0) {
    return { payCurrency: "USD" };
  }

  const rem = remuneration[0];
  const minStr = rem.MinimumRange;
  const maxStr = rem.MaximumRange;
  const interval = rem.RateIntervalCode?.toLowerCase() || "";

  // Parse salary strings (e.g., "50000" or "50,000")
  const parseSalary = (str?: string): number | undefined => {
    if (!str) return undefined;
    const cleaned = str.replace(/,/g, "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? undefined : parsed;
  };

  let payMin = parseSalary(minStr);
  let payMax = parseSalary(maxStr);

  // Convert to annual if needed
  if (interval.includes("hour")) {
    // Assume 2080 hours per year (40 hours/week * 52 weeks)
    payMin = payMin ? Math.round(payMin * 2080) : undefined;
    payMax = payMax ? Math.round(payMax * 2080) : undefined;
  } else if (interval.includes("month")) {
    // Assume 12 months per year
    payMin = payMin ? Math.round(payMin * 12) : undefined;
    payMax = payMax ? Math.round(payMax * 12) : undefined;
  }
  // If already annual or unknown, use as-is

  return {
    payMin,
    payMax,
    payCurrency: "USD",
  };
}

/**
 * Parses location from USAJOBS format
 */
function parseLocation(location: USAJobsLocation): {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
} {
  return {
    city: location.CityName,
    state: location.CountrySubDivisionCode,
    latitude: location.Latitude,
    longitude: location.Longitude,
  };
}

/**
 * Checks if two locations are distinct (different city/state or coordinates)
 */
function areLocationsDistinct(
  loc1: USAJobsLocation,
  loc2: USAJobsLocation
): boolean {
  // If coordinates differ significantly (>1km), consider distinct
  if (loc1.Latitude && loc1.Longitude && loc2.Latitude && loc2.Longitude) {
    const latDiff = Math.abs(loc1.Latitude - loc2.Latitude);
    const lonDiff = Math.abs(loc1.Longitude - loc2.Longitude);
    // Rough check: ~0.01 degrees ≈ 1km
    if (latDiff > 0.01 || lonDiff > 0.01) {
      return true;
    }
  }

  // If city/state differ, consider distinct
  if (
    loc1.CityName !== loc2.CityName ||
    loc1.CountrySubDivisionCode !== loc2.CountrySubDivisionCode
  ) {
    return true;
  }

  return false;
}

/**
 * Normalizes a USAJOBS job to our Job model
 * Returns an array because one posting can have multiple locations
 * Only includes jobs with street addresses (via reverse geocoding)
 */
async function normalizeUSAJobsJob(
  usajobsJob: USAJobsSearchResult
): Promise<JobInput[]> {
  const descriptor = usajobsJob.MatchedObjectDescriptor;
  const sourceId = usajobsJob.MatchedObjectId;

  // Parse description
  const description =
    descriptor.PositionFormattedDescription?.map((d) => d.Content).join("\n\n") ||
    descriptor.PositionLocationDisplay ||
    "";

  // Parse dates
  const postedAt = descriptor.PositionStartDate
    ? new Date(descriptor.PositionStartDate)
    : new Date();

  // Normalize employment type
  const schedule = descriptor.PositionSchedule?.[0]?.Name;
  const employmentType = normalizeEmploymentType(schedule);

  // Normalize salary
  const salary = normalizeSalary(descriptor.PositionRemuneration);

  // Get locations
  const locations = descriptor.PositionLocation || [];

  // If no locations, skip
  if (locations.length === 0) {
    return [];
  }

  // Filter locations with coordinates (required)
  const validLocations = locations.filter(
    (loc) => loc.Latitude && loc.Longitude
  );

  if (validLocations.length === 0) {
    return [];
  }

  // If single location or all locations are essentially the same, create one job
  if (validLocations.length === 1) {
    const loc = validLocations[0];
    const parsedLoc = parseLocation(loc);
    
    // Skip if no coordinates
    if (!parsedLoc.latitude || !parsedLoc.longitude) {
      return [];
    }
    
    // Reverse geocode to get street address
    const fullAddress = await reverseGeocode(parsedLoc.latitude, parsedLoc.longitude);
    
    // Skip if reverse geocoding fails or doesn't provide street
    if (!fullAddress || !fullAddress.street) {
      return [];
    }

    return [
      {
        source: JobSource.USAJOBS,
        sourceId: `${sourceId}-0`, // Add index for multi-location support
        title: descriptor.PositionTitle || "Untitled Position",
        company: descriptor.OrganizationName || "Federal Government",
        description,
        url: descriptor.ApplyURI?.[0] || descriptor.PositionURI || "",
        street: fullAddress.street,
        city: fullAddress.city || parsedLoc.city,
        state: fullAddress.state || parsedLoc.state,
        postalCode: fullAddress.postalCode || parsedLoc.postalCode,
        country: loc.Country || "US",
        latitude: parsedLoc.latitude!,
        longitude: parsedLoc.longitude!,
        employmentType,
        payMin: salary.payMin,
        payMax: salary.payMax,
        payCurrency: salary.payCurrency,
        postedAt,
      },
    ];
  }

  // Multiple distinct locations - create separate jobs for each
  // First, group similar locations
  const distinctLocations: USAJobsLocation[] = [];
  for (const loc of validLocations) {
    const isDuplicate = distinctLocations.some((existing) =>
      !areLocationsDistinct(existing, loc)
    );
    if (!isDuplicate) {
      distinctLocations.push(loc);
    }
  }

  // Create a job for each distinct location (with reverse geocoding for street addresses)
  const jobs: JobInput[] = [];
  
  for (let index = 0; index < distinctLocations.length; index++) {
    const loc = distinctLocations[index];
    const parsedLoc = parseLocation(loc);
    
    // Skip if no coordinates
    if (!parsedLoc.latitude || !parsedLoc.longitude) {
      continue;
    }
    
    // Reverse geocode to get street address
    const fullAddress = await reverseGeocode(parsedLoc.latitude, parsedLoc.longitude);
    
    // Skip if reverse geocoding fails or doesn't provide street
    if (!fullAddress || !fullAddress.street) {
      continue;
    }
    
    jobs.push({
      source: JobSource.USAJOBS,
      sourceId: `${sourceId}-${index}`, // Unique ID per location
      title: descriptor.PositionTitle || "Untitled Position",
      company: descriptor.OrganizationName || "Federal Government",
      description,
      url: descriptor.ApplyURI?.[0] || descriptor.PositionURI || "",
      street: fullAddress.street,
      city: fullAddress.city || parsedLoc.city,
      state: fullAddress.state || parsedLoc.state,
      postalCode: fullAddress.postalCode || parsedLoc.postalCode,
      country: loc.Country || "US",
      latitude: parsedLoc.latitude!,
      longitude: parsedLoc.longitude!,
      employmentType,
      payMin: salary.payMin,
      payMax: salary.payMax,
      payCurrency: salary.payCurrency,
      postedAt,
    });
  }
  
  return jobs;
}

/**
 * Fetches jobs from USAJOBS API around Phoenix metro area
 */
async function fetchUSAJobsJobs(keyword?: string, page = 1): Promise<{
  jobs: USAJobsSearchResult[];
  hasMore: boolean;
}> {
  const host = process.env.USAJOBS_HOST || "data.usajobs.gov";
  const userAgent = process.env.USAJOBS_USER_AGENT;
  const apiKey = process.env.USAJOBS_API_KEY;

  if (!userAgent || !apiKey) {
    throw new Error(
      "USAJOBS_USER_AGENT and USAJOBS_API_KEY must be set in environment"
    );
  }

  // Phoenix metro area search
  // USAJOBS uses keyword search, so we'll search for Phoenix-area locations
  const searchTerms = keyword
    ? `${keyword} Phoenix AZ`
    : "Phoenix AZ";

  // USAJOBS API v2 endpoint - use data.usajobs.gov (not api.usajobs.gov)
  const baseUrl = `https://data.usajobs.gov/api/Search`;
  const params = new URLSearchParams({
    Page: page.toString(),
    ResultsPerPage: "25",
    Keyword: searchTerms,
    LocationName: "Phoenix, Arizona",
    DatePosted: "30", // Last 30 days
  });

  const url = `${baseUrl}?${params.toString()}`;
  // USAJOBS requires Host header to match the domain, but fetch sets it automatically
  // We only need User-Agent and Authorization-Key headers
  const headers = {
    "User-Agent": userAgent!,
    "Authorization-Key": apiKey!,
  };

  try {
    const response = await fetchWithRetry(url, headers);
    const data: USAJobsResponse = await response.json();

    const jobs = data.SearchResult?.SearchResultItems || [];
    const totalCount = data.SearchResult?.SearchResultCount || 0;
    const currentPage = page;
    const resultsPerPage = 25;
    const hasMore = currentPage * resultsPerPage < totalCount;

    return { jobs, hasMore };
  } catch (error) {
    console.error("Error fetching USAJOBS:", error);
    throw error;
  }
}

/**
 * Ingests jobs from USAJOBS API
 */
export async function ingestUSAJobs(keyword?: string): Promise<{
  fetched: number;
  normalized: number;
  created: number;
  updated: number;
  failed: number;
}> {
  console.log("🔍 Fetching jobs from USAJOBS...");
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
    let page = 1;
    let hasMore = true;
    const maxPages = 5; // Limit to prevent excessive API calls

    // Fetch jobs page by page
    while (hasMore && page <= maxPages) {
      console.log(`   Fetching page ${page}...`);

      const { jobs, hasMore: morePages } = await fetchUSAJobsJobs(keyword, page);
      metrics.fetched += jobs.length;
      hasMore = morePages;

      // Process each job
      for (const usajobsJob of jobs) {
        try {
          // Normalize job (may return multiple jobs for multi-location postings)
          const normalizedJobs = await normalizeUSAJobsJob(usajobsJob);

          for (const normalized of normalizedJobs) {
            // Filter to Phoenix area (rough check: within ~50km)
            const phoenixLat = 33.4484;
            const phoenixLon = -112.074;
            const distance =
              Math.sqrt(
                Math.pow(normalized.latitude - phoenixLat, 2) +
                  Math.pow(normalized.longitude - phoenixLon, 2)
              ) * 111; // Rough km conversion

            // Skip if too far from Phoenix
            if (distance > 50) {
              continue;
            }

            metrics.normalized++;

            const { created } = await upsertJob(normalized);

            if (created) {
              metrics.created++;
            } else {
              metrics.updated++;
            }
          }
        } catch (error) {
          metrics.failed++;
          console.error(
            `   ❌ Failed to process job ${usajobsJob.MatchedObjectId}:`,
            error
          );
        }
      }

      page++;

      // Rate limiting: wait between pages
      if (hasMore && page <= maxPages) {
        await sleep(1000); // 1 second between pages
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
    console.error("❌ USAJOBS ingestion failed:", error);
    throw error;
  }
}

