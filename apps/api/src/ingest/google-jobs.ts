import "dotenv/config";
import { JobSource, EmploymentType } from "@prisma/client";
import { upsertJob, JobInput } from "../lib/jobs";
import { geocodeAddressSafe, reverseGeocode } from "../lib/geocode";
import { fetchViaScraperAPI, isScraperAPIConfigured, ScraperAPIOptions } from "./scraperapi";
import * as cheerio from "cheerio";

interface GoogleJob {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  postedDate?: string;
  salary?: string;
  employmentType?: string;
  address?: string;
}

function normalizeEmploymentType(type?: string): EmploymentType | null {
  if (!type) return null;
  const normalized = type.toLowerCase();
  if (normalized.includes("full-time") || normalized.includes("full time")) return EmploymentType.FULL_TIME;
  if (normalized.includes("part-time") || normalized.includes("part time")) return EmploymentType.PART_TIME;
  if (normalized.includes("contract")) return EmploymentType.CONTRACT;
  if (normalized.includes("temporary") || normalized.includes("temp")) return EmploymentType.TEMP;
  if (normalized.includes("internship")) return EmploymentType.INTERN;
  return null;
}

function parseSalary(salaryText?: string): { payMin?: number; payMax?: number } {
  if (!salaryText) return {};
  
  // Extract numbers (handles formats like "$50,000 - $60,000", "$50k-$60k", etc.)
  const numbers = salaryText.match(/[\d,]+/g)?.map(n => parseInt(n.replace(/,/g, ""))) || [];
  
  if (numbers.length === 0) return {};
  
  let payMin: number | undefined;
  let payMax: number | undefined;
  
  if (numbers.length === 1) {
    payMin = numbers[0];
    payMax = numbers[0];
  } else {
    payMin = Math.min(...numbers);
    payMax = Math.max(...numbers);
  }
  
  // If numbers seem low (like 15-20), might be hourly - multiply by 2080 for annual estimate
  if (payMax && payMax < 100) {
    payMin = payMin ? payMin * 2080 : undefined;
    payMax = payMax * 2080;
  }
  
  return { payMin, payMax };
}

/**
 * Extracts address from job description or location field
 */
function extractAddress(location: string, description: string): string | undefined {
  // Look for common address patterns
  const addressPatterns = [
    /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl)[,\s]+(?:[A-Za-z\s]+,\s*)?[A-Z]{2}\s+\d{5}/i,
    /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl)/i,
  ];
  
  for (const pattern of addressPatterns) {
    const match = location.match(pattern) || description.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  return undefined;
}

async function normalizeGoogleJob(job: GoogleJob): Promise<JobInput | null> {
  // Try to extract or use provided address
  const streetAddress = job.address || extractAddress(job.location, job.description);
  
  // Build geocoding query - prefer street address if available
  const geocodeQuery = streetAddress 
    ? `${streetAddress}, ${job.location}`
    : job.location;
  
  const geocodeResult = await geocodeAddressSafe(geocodeQuery);
  if (!geocodeResult) {
    return null;
  }
  
  // If we have coordinates but no street address, try reverse geocoding
  let finalStreetAddress = streetAddress;
  if (!finalStreetAddress) {
    const reverseGeocoded = await reverseGeocode(geocodeResult.lat, geocodeResult.lon);
    if (reverseGeocoded?.street) {
      finalStreetAddress = reverseGeocoded.street;
    }
  }
  
  // Skip if we still don't have a street address
  if (!finalStreetAddress) {
    return null;
  }
  
  // Extract job ID from URL
  const urlParts = job.url.split("/");
  const jobId = urlParts[urlParts.length - 1]?.split("?")[0] || 
                Buffer.from(job.url).toString('base64').substring(0, 50);
  
  // Parse posted date
  let postedAt: Date;
  if (job.postedDate) {
    const parsed = new Date(job.postedDate);
    postedAt = isNaN(parsed.getTime()) ? new Date() : parsed;
  } else {
    postedAt = new Date();
  }
  
  const employmentType = normalizeEmploymentType(job.employmentType);
  const salary = parseSalary(job.salary);
  
  // Parse location to get city/state
  const locationParts = job.location.split(",").map(p => p.trim());
  const city = locationParts[0] || undefined;
  const state = locationParts[1]?.match(/^[A-Z]{2}/)?.[0] || undefined;
  
  return {
    source: JobSource.GOOGLE_JOBS,
    sourceId: `google-${jobId}`,
    title: job.title,
    company: job.company,
    description: job.description,
    url: job.url,
    street: finalStreetAddress,
    city: city,
    state: state,
    country: "US",
    latitude: geocodeResult.lat,
    longitude: geocodeResult.lon,
    employmentType,
    payMin: salary.payMin,
    payMax: salary.payMax,
    payCurrency: "USD",
    postedAt,
  };
}

async function scrapeGoogleJobs(
  location = "Phoenix, AZ",
  keyword?: string,
  maxResults = 50
): Promise<GoogleJob[]> {
  // Build Google Jobs search URL
  const searchQuery = keyword 
    ? `${keyword} jobs in ${location}`
    : `jobs in ${location}`;
  
  const encodedQuery = encodeURIComponent(searchQuery);
  const searchUrl = `https://www.google.com/search?q=${encodedQuery}&ibp=htl;jobs`;
  
  console.log(`   🔄 Fetching Google Jobs via ScraperAPI: ${searchQuery}`);
  
  if (!isScraperAPIConfigured()) {
    throw new Error("SCRAPERAPI_KEY not set. Google requires ScraperAPI to bypass blocking.");
  }
  
  // Use ScraperAPI to bypass Google's blocking
  const options: ScraperAPIOptions = {
    apiKey: process.env.SCRAPERAPI_KEY!,
    url: searchUrl,
    render: true, // Google Jobs requires JavaScript rendering
    countryCode: "us",
    premium: true, // Google requires premium proxies
  };
  
  const html = await fetchViaScraperAPI(options);
  const $ = cheerio.load(html);
  
  const jobs: GoogleJob[] = [];
  
  // Extract jobs from HTML - Google Jobs uses specific structure
  $("div[data-ved], div.g, [class*='job']").each((i, element) => {
    if (i >= maxResults) return false;
    
    const $el = $(element);
    const text = $el.text();
    
    // Skip if it doesn't look like a job listing
    if (!text.includes("·") || text.length < 50) return;
    
    // Extract title
    const titleEl = $el.find("h3, h2, h4, [class*='title']").first();
    let title = titleEl.text().trim();
    
    if (!title || title.length < 5) {
      // Try extracting from text pattern
      const titleMatch = text.match(/^([^·\n]{10,}?)(?:\s*·|\s*\n)/);
      title = titleMatch ? titleMatch[1].trim() : "";
    }
    
    if (!title || title.length < 5) return;
    if (title.includes("Search") || title.includes("Filter")) return;
    
    // Extract company and location (usually separated by ·)
    const parts = text.split("·").map(p => p.trim()).filter(p => p);
    const company = parts[1] || "Unknown";
    const location = parts[2] || "";
    
    // Extract salary
    const salaryMatch = text.match(/\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*(?:per|an|hour|year|month|yr|hr))?/i);
    const salary = salaryMatch ? salaryMatch[0] : undefined;
    
    // Find job URL
    const linkEl = $el.find("a[href*='jobs'], a[href*='linkedin'], a[href*='indeed']").first();
    let url = linkEl.attr("href") || "";
    
    // Skip Google redirect URLs
    if (url.includes("google.com/url")) {
      const redirectMatch = url.match(/url\?q=([^&]+)/);
      url = redirectMatch ? decodeURIComponent(redirectMatch[1]) : "";
    }
    
    if (title && url && company !== "Unknown" && url.length > 10) {
      jobs.push({ title, company, location, url, salary, description: "" });
    }
  });
  
  console.log(`   📋 Found ${jobs.length} jobs from Google`);
  
      // Extract descriptions from snippets if available
      jobs.forEach((job, i) => {
        const $jobEl = $("div[data-ved], div.g").eq(i);
        const snippet = $jobEl.find("[class*='snippet'], [class*='description'], .s").text().trim();
        if (job) {
          job.description = snippet || "Job description available on original source";
        }
      });
  
  return jobs;
}

export async function ingestGoogleJobs(
  location = "Phoenix, AZ",
  keyword?: string
): Promise<{
  fetched: number;
  normalized: number;
  created: number;
  updated: number;
  failed: number;
}> {
  console.log(`🔍 Scraping Google Jobs for: ${location}${keyword ? ` (keyword: ${keyword})` : ""}`);
  
  const stats = {
    fetched: 0,
    normalized: 0,
    created: 0,
    updated: 0,
    failed: 0,
  };
  
  try {
    const jobs = await scrapeGoogleJobs(location, keyword, 50);
    stats.fetched = jobs.length;
    
    console.log(`   📥 Fetched ${jobs.length} jobs from Google Jobs`);
    
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      if ((i + 1) % 10 === 0) {
        console.log(`   ⏳ Processing job ${i + 1}/${jobs.length}...`);
      }
      
      try {
        const normalized = await normalizeGoogleJob(job);
        if (!normalized) {
          stats.failed++;
          continue;
        }
        
        const { created } = await upsertJob(normalized);
        if (created) {
          stats.created++;
        } else {
          stats.updated++;
        }
        stats.normalized++;
      } catch (error) {
        console.error(`   ❌ Failed to process job: ${job.title}`, error);
        stats.failed++;
      }
    }
  } catch (error) {
    console.error("❌ Google Jobs ingestion failed:", error);
    stats.failed = -1;
  }
  
  console.log(
    `   ✅ Google Jobs: ${stats.created} created, ${stats.updated} updated, ${stats.failed} failed`
  );
  return stats;
}

