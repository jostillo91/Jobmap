import "dotenv/config";
import { JobSource, EmploymentType } from "@prisma/client";
import { upsertJob, JobInput } from "../lib/jobs";
import { geocodeAddressSafe } from "../lib/geocode";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import AnonymizeUAPlugin from "puppeteer-extra-plugin-anonymize-ua";
import { Browser, Page } from "puppeteer";

// Add stealth plugin to avoid detection
puppeteer.use(StealthPlugin());
puppeteer.use(AnonymizeUAPlugin());

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
 * Sleep utility for rate limiting
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
 * Parses salary string (e.g., "$50,000 - $70,000 a year")
 */
function parseSalary(salaryStr?: string): { payMin?: number; payMax?: number } {
  if (!salaryStr) return {};

  // Extract numbers from salary string
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
 * Parses location string to extract city, state, etc.
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
 * Scrapes Indeed jobs for a given location and keyword
 */
async function scrapeIndeedJobs(
  page: Page,
  location: string,
  keyword?: string,
  maxResults = 25
): Promise<IndeedJob[]> {
  // Build Indeed search URL
  const searchParams = new URLSearchParams();
  if (keyword) {
    searchParams.set("q", keyword);
  }
  searchParams.set("l", location);
  searchParams.set("fromage", "1"); // Last 24 hours
  searchParams.set("sort", "date"); // Sort by date

  const url = `https://www.indeed.com/jobs?${searchParams.toString()}`;

  try {
    await page.goto(url, { 
      waitUntil: "domcontentloaded", 
      timeout: 60000 
    });
    
    // Wait for Cloudflare challenge if present
    try {
      await page.waitForFunction(
        () => document.title !== "Just a moment..." && !document.querySelector("#challenge-form"),
        { timeout: 15000 }
      );
      console.log("   ✅ Cloudflare challenge passed");
    } catch (e) {
      console.warn("   ⚠️  Cloudflare challenge may still be active");
    }
    
    await sleep(2000 + Math.random() * 2000);
    
    // Scroll slowly
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    
    await sleep(2000);

    // Wait for job listings to appear
    try {
      await page.waitForSelector(".job_seen_beacon, [data-testid='job-card'], .jobCard", { timeout: 10000 });
    } catch (e) {
      console.warn("   ⚠️  Job listings container not found, trying alternative selectors...");
    }

    // Scroll to load more jobs
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await sleep(2000);

    // Extract job listings - try multiple selector strategies
    const jobs = await page.evaluate((max) => {
      const results: IndeedJob[] = [];
      
      // Try multiple selector strategies
      let jobElements = document.querySelectorAll(".job_seen_beacon");
      if (jobElements.length === 0) {
        jobElements = document.querySelectorAll("[data-testid='job-card']");
      }
      if (jobElements.length === 0) {
        jobElements = document.querySelectorAll(".jobCard");
      }

      for (let i = 0; i < Math.min(jobElements.length, max); i++) {
        const element = jobElements[i];
        // Try multiple selector strategies for each field
        const titleEl = element.querySelector("h2.jobTitle a, h2 a, [data-testid='job-title'] a, .jobTitle a");
        const companyEl = element.querySelector('[data-testid="company-name"], .companyName, .company');
        const locationEl = element.querySelector('[data-testid="text-location"], .location, .jobLocation');
        const salaryEl = element.querySelector('[data-testid="attribute_snippet_testid"], .salaryText, .salary');
        const linkEl = titleEl || element.querySelector("a");

        if (titleEl && companyEl && locationEl) {
          const title = titleEl.textContent?.trim() || "";
          const company = companyEl.textContent?.trim() || "";
          const location = locationEl.textContent?.trim() || "";
          const salary = salaryEl?.textContent?.trim() || "";
          const url = linkEl.getAttribute("href") || "";

          if (title && company && location) {
            results.push({
              title,
              company,
              location,
              description: "", // Will be filled when clicking job
              url: url.startsWith("http") ? url : `https://www.indeed.com${url}`,
              salary: salary || undefined,
            });
          }
        }
      }

      return results;
    }, maxResults);

    // Fetch job descriptions (with rate limiting)
    for (let i = 0; i < jobs.length; i++) {
      try {
        await page.goto(jobs[i].url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(1000 + Math.random() * 1000);

        const description = await page.evaluate(() => {
          const descEl = document.querySelector("#jobDescriptionText");
          return descEl?.textContent?.trim() || "";
        });

        jobs[i].description = description || "No description available";
        await sleep(1000 + Math.random() * 1000);
      } catch (error) {
        console.warn(`Failed to fetch description for job ${i + 1}:`, error);
        jobs[i].description = "Description unavailable";
      }
    }

    return jobs;
  } catch (error) {
    console.error("Indeed scraping error:", error);
    throw error;
  }
}

/**
 * Normalizes an Indeed job to our Job model
 */
async function normalizeIndeedJob(indeedJob: IndeedJob): Promise<JobInput | null> {
  const locationParts = parseLocation(indeedJob.location);

  // Geocode the location
  const geocodeResult = await geocodeAddressSafe({
    city: locationParts.city,
    state: locationParts.state,
    country: locationParts.country || "US",
  });

  if (!geocodeResult) {
    console.warn(`Failed to geocode location: ${indeedJob.location}`);
    return null;
  }

  // Parse posted date
  const postedAt = indeedJob.postedDate
    ? new Date(indeedJob.postedDate)
    : new Date();

  // Normalize employment type
  const employmentType = normalizeEmploymentType(indeedJob.employmentType);

  // Parse salary
  const salary = parseSalary(indeedJob.salary);

  // Extract source ID from URL
  const urlParts = indeedJob.url.split("/");
  const jobId = urlParts[urlParts.length - 1]?.split("?")[0] || indeedJob.url;
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
 * Ingests jobs from Indeed
 */
export async function ingestIndeed(
  location = "Phoenix, AZ",
  keyword?: string
): Promise<{
  fetched: number;
  normalized: number;
  created: number;
  updated: number;
  failed: number;
}> {
  console.log(`🔍 Scraping Indeed jobs for: ${location}${keyword ? ` (keyword: ${keyword})` : ""}`);

  const stats = {
    fetched: 0,
    normalized: 0,
    created: 0,
    updated: 0,
    failed: 0,
  };

  let browser: Browser | null = null;

  try {
    // Launch browser with stealth settings
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--window-size=1920,1080",
      ],
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
      (window as any).chrome = { runtime: {} };
    });

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    });

    // Scrape jobs
    const jobs = await scrapeIndeedJobs(page, location, keyword, 25);
    stats.fetched = jobs.length;

    console.log(`   📥 Fetched ${jobs.length} jobs from Indeed`);
    
    // Debug: Check page state
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log(`   🔍 Current URL: ${currentUrl}`);
    console.log(`   🔍 Page title: ${pageTitle}`);
    
    if (jobs.length === 0) {
      // Take screenshot for debugging
      try {
        await page.screenshot({ path: 'debug-indeed.png', fullPage: true });
        console.log("   📸 Screenshot saved to debug-indeed.png");
      } catch (e) {
        console.warn("   ⚠️  Could not save screenshot");
      }
    }

    // Normalize and upsert each job
    for (const job of jobs) {
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
      `   ✅ Indeed: ${stats.created} created, ${stats.updated} updated, ${stats.failed} failed`
    );
  } catch (error) {
    console.error("❌ Indeed ingestion failed:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return stats;
}

