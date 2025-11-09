import "dotenv/config";
import { JobSource, EmploymentType } from "@prisma/client";
import { upsertJob, JobInput } from "../lib/jobs";
import { geocodeAddressSafe } from "../lib/geocode";
import { fetchViaScraperAPI, isScraperAPIConfigured, getScraperAPIKey } from "./scraperapi";
import * as cheerio from "cheerio";

interface IndeedJob {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  postedDate?: string;
  salary?: string;
  employmentType?: string;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalizes Indeed employment type to our enum
 */
function normalizeEmploymentType(type?: string): EmploymentType | null {
  if (!type) return null;

  const normalized = type.toLowerCase();
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
 * Parses salary string
 */
function parseSalary(salaryStr?: string): { payMin?: number; payMax?: number } {
  if (!salaryStr) return {};

  const numbers = salaryStr.match(/\$?([\d,]+)/g);
  if (!numbers || numbers.length === 0) return {};

  const amounts = numbers
    .map((n) => parseInt(n.replace(/[$,]/g, "")))
    .filter((n) => !isNaN(n));

  if (amounts.length === 0) return {};
  if (amounts.length === 1) {
    return { payMin: amounts[0], payMax: amounts[0] };
  }

  return {
    payMin: Math.min(...amounts),
    payMax: Math.max(...amounts),
  };
}

/**
 * Parses location string
 */
function parseLocation(locationStr: string): {
  city?: string;
  state?: string;
  country?: string;
} {
  const parts = locationStr.split(",").map((p) => p.trim());

  if (locationStr.toLowerCase().includes("remote")) {
    return { country: "US" };
  }

  return {
    city: parts[0] || undefined,
    state: parts[1]?.length === 2 ? parts[1] : undefined,
    country: parts[2] || "US",
  };
}

/**
 * Scrapes Indeed jobs using ScraperAPI
 */
async function scrapeIndeedJobsViaAPI(
  location: string,
  keyword?: string,
  maxResults = 25
): Promise<IndeedJob[]> {
  if (!isScraperAPIConfigured()) {
    throw new Error("SCRAPERAPI_KEY not set in environment");
  }

  const apiKey = getScraperAPIKey()!;

  // Build Indeed search URL
  const searchParams = new URLSearchParams();
  if (keyword) {
    searchParams.set("q", keyword);
  }
  searchParams.set("l", location);
  searchParams.set("fromage", "1"); // Last 24 hours
  searchParams.set("sort", "date");

  const indeedUrl = `https://www.indeed.com/jobs?${searchParams.toString()}`;

  console.log(`   🔄 Fetching via ScraperAPI: ${indeedUrl}`);

  // Fetch HTML via ScraperAPI (use premium for Indeed)
  const html = await fetchViaScraperAPI({
    apiKey,
    url: indeedUrl,
    render: true, // Use JavaScript rendering for dynamic content
    countryCode: "us",
    premium: true, // Indeed requires premium proxies
  });

  // Parse HTML with cheerio
  const $ = cheerio.load(html);
  const jobs: IndeedJob[] = [];

  // Extract job listings - try multiple selectors
  $(".job_seen_beacon, [data-testid='job-card'], .jobCard").each((i, element) => {
    if (jobs.length >= maxResults) return false; // Stop after maxResults

    const $el = $(element);
    const titleEl = $el.find("h2.jobTitle a, h2 a, [data-testid='job-title'] a, .jobTitle a").first();
    const companyEl = $el.find('[data-testid="company-name"], .companyName, .company').first();
    const locationEl = $el.find('[data-testid="text-location"], .location, .jobLocation').first();
    const salaryEl = $el.find('[data-testid="attribute_snippet_testid"], .salaryText, .salary').first();
    const linkEl = titleEl.length ? titleEl : $el.find("a").first();

    if (titleEl.length && companyEl.length && locationEl.length) {
      const title = titleEl.text().trim();
      const company = companyEl.text().trim();
      const location = locationEl.text().trim();
      const salary = salaryEl.text().trim() || undefined;
      const url = linkEl.attr("href") || "";

      if (title && company && location) {
        const fullUrl = url.startsWith("http") ? url : `https://www.indeed.com${url}`;
        jobs.push({
          title,
          company,
          location,
          description: "", // Will fetch separately
          url: fullUrl,
          salary,
        });
      }
    }
  });

  // Extract descriptions from list page if available (much faster than fetching each job)
  $(".job_seen_beacon, [data-testid='job-card'], .jobCard").each((i, element) => {
    if (i >= jobs.length) return false;
    
    const $el = $(element);
    const snippet = $el.find(".job-snippet, .summary, [data-testid='job-snippet']").text().trim();
    if (snippet) {
      jobs[i].description = snippet.substring(0, 500) + (snippet.length > 500 ? "..." : "");
    } else {
      jobs[i].description = "Job description available on Indeed";
    }
  });
  
  // Fill in any missing descriptions
  for (let i = 0; i < jobs.length; i++) {
    if (!jobs[i].description || jobs[i].description === "") {
      jobs[i].description = "Job description available on Indeed";
    }
  }

  return jobs;
}

/**
 * Normalizes an Indeed job to our Job model
 */
async function normalizeIndeedJob(indeedJob: IndeedJob): Promise<JobInput | null> {
  const locationParts = parseLocation(indeedJob.location);

  const geocodeResult = await geocodeAddressSafe({
    city: locationParts.city,
    state: locationParts.state,
    country: locationParts.country || "US",
  });

  if (!geocodeResult) {
    console.warn(`Failed to geocode location: ${indeedJob.location}`);
    return null;
  }

  const postedAt = indeedJob.postedDate ? new Date(indeedJob.postedDate) : new Date();
  const employmentType = normalizeEmploymentType(indeedJob.employmentType);
  const salary = parseSalary(indeedJob.salary);

  // Extract job ID from Indeed URL
  // URLs can be: /viewjob?jk=abc123 or /rc/clk?jk=abc123 or /clk?jk=abc123
  let jobId: string | null = null;
  
  // Try to extract from jk parameter
  const jkMatch = indeedJob.url.match(/[?&]jk=([^&]+)/);
  if (jkMatch && jkMatch[1]) {
    jobId = jkMatch[1];
  } else {
    // Fallback: use URL path or hash
    const urlParts = indeedJob.url.split("/");
    const lastPart = urlParts[urlParts.length - 1]?.split("?")[0]?.split("#")[0];
    if (lastPart && lastPart.length > 5) {
      jobId = lastPart;
    } else {
      // Use full URL hash as fallback
      jobId = Buffer.from(indeedJob.url).toString('base64').substring(0, 50);
    }
  }
  
  const sourceId = `indeed-${jobId}`;

  return {
    source: JobSource.INDEED,
    sourceId,
    title: indeedJob.title,
    company: indeedJob.company,
    description: indeedJob.description,
    url: indeedJob.url,
    city: locationParts.city,
    state: locationParts.state,
    country: locationParts.country || "US",
    latitude: geocodeResult.lat,
    longitude: geocodeResult.lon,
    employmentType,
    payMin: salary.payMin,
    payMax: salary.payMax,
    payCurrency: "USD",
    postedAt,
  };
}

/**
 * Ingests jobs from Indeed using ScraperAPI
 */
export async function ingestIndeedViaScraperAPI(
  location = "Phoenix, AZ",
  keyword?: string
): Promise<{
  fetched: number;
  normalized: number;
  created: number;
  updated: number;
  failed: number;
}> {
  if (!isScraperAPIConfigured()) {
    throw new Error("SCRAPERAPI_KEY not set. Get your free API key at https://www.scraperapi.com/");
  }

  console.log(`🔍 Scraping Indeed jobs via ScraperAPI for: ${location}${keyword ? ` (keyword: ${keyword})` : ""}`);

  const stats = {
    fetched: 0,
    normalized: 0,
    created: 0,
    updated: 0,
    failed: 0,
  };

  try {
    const startTime = Date.now();
    const jobs = await scrapeIndeedJobsViaAPI(location, keyword, 25);
    stats.fetched = jobs.length;
    const fetchTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`   📥 Fetched ${jobs.length} jobs from Indeed via ScraperAPI (${fetchTime}s)`);

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      if ((i + 1) % 5 === 0) {
        console.log(`   ⏳ Processing job ${i + 1}/${jobs.length}...`);
      }
      try {
        const normalized = await normalizeIndeedJob(job);
        if (!normalized) {
          stats.failed++;
          continue;
        }

        stats.normalized++;
        const result = await upsertJob(normalized);

        if (result.created) {
          stats.created++;
        } else {
          stats.updated++;
        }
      } catch (error) {
        console.error(`   ❌ Failed to process job: ${job.title}`, error);
        stats.failed++;
      }
    }

    console.log(
      `   ✅ Indeed (ScraperAPI): ${stats.created} created, ${stats.updated} updated, ${stats.failed} failed`
    );
  } catch (error) {
    console.error("❌ Indeed ingestion via ScraperAPI failed:", error);
    throw error;
  }

  return stats;
}

