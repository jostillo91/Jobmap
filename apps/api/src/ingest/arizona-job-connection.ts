import "dotenv/config";
import { JobSource, EmploymentType } from "@prisma/client";
import { upsertJob, JobInput } from "../lib/jobs";
import { geocodeAddressSafe, reverseGeocode } from "../lib/geocode";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AnonymizeUAPlugin from "puppeteer-extra-plugin-anonymize-ua";
import { Browser, Page } from "puppeteer";

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());
puppeteer.use(AnonymizeUAPlugin());

interface ArizonaJobConnectionJob {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  postedDate?: string;
  salary?: string;
  employmentType?: string;
  address?: string; // Full street address if available
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  
  // Try to extract numbers (handles formats like "$50,000 - $60,000", "$50k-$60k", etc.)
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
  // Look for common address patterns in location or description
  const addressPatterns = [
    /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl)[,\s]+(?:[A-Za-z\s]+,\s*)?[A-Z]{2}\s+\d{5}/i,
    /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl)/i,
  ];
  
  // Check location first
  for (const pattern of addressPatterns) {
    const match = location.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  // Check description
  for (const pattern of addressPatterns) {
    const match = description.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  return undefined;
}

async function normalizeArizonaJobConnectionJob(
  job: ArizonaJobConnectionJob
): Promise<JobInput | null> {
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
  
  // Parse posted date - handle various formats
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
    source: JobSource.ARIZONA_JOB_CONNECTION,
    sourceId: `azjobconnection-${jobId}`,
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

async function scrapeArizonaJobConnectionJobs(
  page: Page,
  location = "Phoenix, AZ",
  keyword?: string,
  maxResults = 50
): Promise<ArizonaJobConnectionJob[]> {
  // Build search URL for Arizona Job Connection
  const searchParams = new URLSearchParams();
  if (keyword) {
    searchParams.set("search_job_search[keywords]", keyword);
  }
  searchParams.set("search_job_search[job_location_city]", location.split(",")[0].trim());
  searchParams.set("search_job_search[job_location_state]", "Arizona");
  searchParams.set("search_job_search[radius]", "50");
  
  const baseUrl = "https://www.azjobconnection.gov";
  const searchUrl = `${baseUrl}/search/jobs?${searchParams.toString()}`;
  
  console.log(`   🔄 Navigating to: ${searchUrl}`);
  
  await page.goto(searchUrl, {
    waitUntil: "networkidle2",
    timeout: 60000
  });
  
  await sleep(3000); // Wait for dynamic content to load
  
  // Wait for job listings to appear (try multiple selectors)
  try {
    await page.waitForSelector(
      ".job-listing, .job-item, .job-card, .search-result, table tbody tr, [class*='job'], [class*='result']",
      { timeout: 10000 }
    );
  } catch (e) {
    console.warn("   ⚠️  Job listings selector not found, continuing anyway...");
  }
  
  // Extract jobs from the page - look for actual job listing rows/items
  const jobs = await page.evaluate((max, base) => {
    const results: Array<{title: string; company: string; location: string; url: string; description?: string; address?: string; postedDate?: string; salary?: string}> = [];
    
    // Look for table rows that contain job links (most common pattern for job boards)
    const jobRows = Array.from(document.querySelectorAll("table tbody tr")).filter((tr: Element) => {
      const link = tr.querySelector("a[href*='/jobs/']");
      const title = tr.querySelector("h3, h4, .title, [class*='title'], a");
      return link && title && title.textContent && title.textContent.trim().length > 5;
    });
    
    // Also try div/li elements with job links
    const jobCards = Array.from(document.querySelectorAll("div[class*='job'], li[class*='job'], article[class*='job']")).filter((el: Element) => {
      const link = el.querySelector("a[href*='/jobs/']");
      return link && link.textContent && link.textContent.trim().length > 5;
    });
    
    const allJobElements = [...jobRows, ...jobCards].slice(0, max);
    
    for (const el of allJobElements) {
      const linkEl = el.querySelector("a[href*='/jobs/']") as HTMLAnchorElement | null;
      if (!linkEl) continue;
      
      const title = linkEl.textContent?.trim() || "";
      // Skip if title looks like a UI element (too short, contains "Total", "Keyword", etc.)
      if (title.length < 10 || title.includes("Total") || title === "Keyword" || title === "Location") {
        continue;
      }
      
      const href = linkEl.href || linkEl.getAttribute("href") || "";
      const url = href.startsWith("http") ? href : `${base}${href.startsWith("/") ? "" : "/"}${href}`;
      
      // Try to find company and location in the same element
      const companyEl = el.querySelector(".company, .employer, [class*='company'], td:nth-child(2)");
      const locationEl = el.querySelector(".location, [class*='location'], [class*='city'], td:nth-child(3)");
      
      const company = companyEl?.textContent?.trim() || "Unknown";
      const location = locationEl?.textContent?.trim() || "";
      
      if (title && url && url.includes("/jobs/")) {
        results.push({ title, company, location, url });
      }
    }
    
    return results;
  }, maxResults, baseUrl);
  
  console.log(`   📋 Found ${jobs.length} jobs`);
  
  // Fetch job descriptions and additional details from detail pages
  for (let i = 0; i < jobs.length; i++) {
    try {
      await sleep(1000 + Math.random() * 1000); // Rate limit
      
      await page.goto(jobs[i].url, {
        waitUntil: "networkidle2",
        timeout: 30000
      });
      
      await sleep(2000); // Wait for content to load
      
      const details = await page.evaluate(() => {
        const descriptionEl = document.querySelector(".job-description, .description, #job-description, .job-details, main, .content");
        const addressEl = document.querySelector(".address, .job-address, [data-address], .location-detail, [class*='address']");
        const dateEl = document.querySelector(".posted-date, .date-posted, [data-date], [class*='date']");
        const salaryEl = document.querySelector(".salary, .pay, .compensation, [data-salary], [class*='salary']");
        
        return {
          description: descriptionEl?.textContent?.trim() || "No description available",
          address: addressEl?.textContent?.trim() || undefined,
          postedDate: dateEl?.textContent?.trim() || undefined,
          salary: salaryEl?.textContent?.trim() || undefined,
        };
      });
      
      jobs[i].description = details.description;
      if (details.address && details.address.match(/\d/)) {
        jobs[i].address = details.address;
      }
      jobs[i].postedDate = details.postedDate;
      jobs[i].salary = details.salary;
      
    } catch (error) {
      console.warn(`   ⚠️  Failed to fetch details for job ${i + 1}:`, error);
      jobs[i].description = "Description unavailable";
    }
  }
  
  return jobs;
}

export async function ingestArizonaJobConnection(
  location = "Phoenix, AZ",
  keyword?: string
): Promise<{
  fetched: number;
  normalized: number;
  created: number;
  updated: number;
  failed: number;
}> {
  console.log(`🔍 Scraping Arizona Job Connection jobs for: ${location}${keyword ? ` (keyword: ${keyword})` : ""}`);
  
  const stats = {
    fetched: 0,
    normalized: 0,
    created: 0,
    updated: 0,
    failed: 0,
  };
  
  let browser: Browser | null = null;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1920,1080",
      ],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    });
    
    const jobs = await scrapeArizonaJobConnectionJobs(page, location, keyword, 50);
    stats.fetched = jobs.length;
    
    console.log(`   📥 Fetched ${jobs.length} jobs from Arizona Job Connection`);
    
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      if ((i + 1) % 10 === 0) {
        console.log(`   ⏳ Processing job ${i + 1}/${jobs.length}...`);
      }
      
      try {
        const normalized = await normalizeArizonaJobConnectionJob(job);
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
    console.error("❌ Arizona Job Connection ingestion failed:", error);
    stats.failed = -1;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  console.log(
    `   ✅ Arizona Job Connection: ${stats.created} created, ${stats.updated} updated, ${stats.failed} failed`
  );
  return stats;
}

