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

interface LinkedInJob {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  postedDate?: string;
  salary?: {
    min?: number;
    max?: number;
  };
  employmentType?: string;
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalizes LinkedIn employment type to our enum
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
 * Parses location string to extract city, state, etc.
 */
function parseLocation(locationStr: string): {
  city?: string;
  state?: string;
  country?: string;
} {
  // Common formats: "City, State", "City, State, Country", "Remote", etc.
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
 * Scrapes LinkedIn jobs for a given location and keyword
 */
async function scrapeLinkedInJobs(
  page: Page,
  location: string,
  keyword?: string,
  maxResults = 25
): Promise<LinkedInJob[]> {
  // Build LinkedIn search URL
  const searchParams = new URLSearchParams();
  if (keyword) {
    searchParams.set("keywords", keyword);
  }
  searchParams.set("location", location);
  searchParams.set("f_TPR", "r86400"); // Last 24 hours
  searchParams.set("f_E", "2,3,4"); // Full-time, Part-time, Contract

  const url = `https://www.linkedin.com/jobs/search?${searchParams.toString()}`;

  try {
    // Navigate with more human-like behavior
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
    
    // Random delay to simulate human behavior
    await sleep(2000 + Math.random() * 2000);
    
    // Scroll slowly to simulate human reading
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
      await page.waitForSelector(".jobs-search__results-list, .scaffold-layout__list, [data-test-id='job-card']", { timeout: 10000 });
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
      const results: LinkedInJob[] = [];
      
      // Try multiple selector strategies
      let jobElements = document.querySelectorAll(".jobs-search__results-list li");
      console.log(`Found ${jobElements.length} jobs with .jobs-search__results-list li`);
      if (jobElements.length === 0) {
        jobElements = document.querySelectorAll(".scaffold-layout__list-container li");
        console.log(`Found ${jobElements.length} jobs with .scaffold-layout__list-container li`);
      }
      if (jobElements.length === 0) {
        jobElements = document.querySelectorAll("[data-test-id='job-card']");
        console.log(`Found ${jobElements.length} jobs with [data-test-id='job-card']`);
      }
      if (jobElements.length === 0) {
        jobElements = document.querySelectorAll(".job-card-container");
        console.log(`Found ${jobElements.length} jobs with .job-card-container`);
      }
      
      // Debug: log page title and URL
      console.log(`Page title: ${document.title}`);
      console.log(`Page URL: ${window.location.href}`);

      for (let i = 0; i < Math.min(jobElements.length, max); i++) {
        const element = jobElements[i];
        // Try multiple selector strategies for each field
        const titleEl = element.querySelector(".base-search-card__title a, .job-card-list__title a, h3 a, [data-test-id='job-title']");
        const companyEl = element.querySelector(".base-search-card__subtitle a, .job-card-container__company-name a, [data-test-id='job-company']");
        const locationEl = element.querySelector(".job-search-card__location, .job-card-container__metadata-item, [data-test-id='job-location']");
        const linkEl = element.querySelector(".base-search-card__full-link, .job-card-list__title a, h3 a");

        if (titleEl && companyEl && locationEl && linkEl) {
          const title = titleEl.textContent?.trim() || "";
          const company = companyEl.textContent?.trim() || "";
          const location = locationEl.textContent?.trim() || "";
          const url = linkEl.getAttribute("href") || "";

          if (title && company && location && url) {
            results.push({
              title,
              company,
              location,
              description: "", // Will be filled when clicking job
              url: url.startsWith("http") ? url : `https://www.linkedin.com${url}`,
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
        await sleep(1000 + Math.random() * 1000); // Random delay between 1-2 seconds

        const description = await page.evaluate(() => {
          const descEl = document.querySelector(".show-more-less-html__markup");
          return descEl?.textContent?.trim() || "";
        });

        jobs[i].description = description || "No description available";
        await sleep(1000 + Math.random() * 1000); // Random delay 1-2 seconds between requests
      } catch (error) {
        console.warn(`Failed to fetch description for job ${i + 1}:`, error);
        jobs[i].description = "Description unavailable";
      }
    }

    return jobs;
  } catch (error) {
    console.error("LinkedIn scraping error:", error);
    throw error;
  }
}

/**
 * Normalizes a LinkedIn job to our Job model
 */
async function normalizeLinkedInJob(
  linkedInJob: LinkedInJob
): Promise<JobInput | null> {
  const locationParts = parseLocation(linkedInJob.location);

  // Geocode the location
  const geocodeResult = await geocodeAddressSafe({
    city: locationParts.city,
    state: locationParts.state,
    country: locationParts.country || "US",
  });

  if (!geocodeResult) {
    console.warn(`Failed to geocode location: ${linkedInJob.location}`);
    return null;
  }

  // Parse posted date
  const postedAt = linkedInJob.postedDate
    ? new Date(linkedInJob.postedDate)
    : new Date();

  // Normalize employment type
  const employmentType = normalizeEmploymentType(linkedInJob.employmentType);

  // Extract source ID from URL
  const urlParts = linkedInJob.url.split("/");
  const sourceId = urlParts[urlParts.length - 1] || linkedInJob.url;

  return {
    source: JobSource.LINKEDIN,
    sourceId: `linkedin-${sourceId}`,
    title: linkedInJob.title,
    company: linkedInJob.company,
    description: linkedInJob.description,
    url: linkedInJob.url,
    city: locationParts.city,
    state: locationParts.state,
    country: locationParts.country || "US",
    latitude: geocodeResult.lat,
    longitude: geocodeResult.lon,
    employmentType,
    payMin: linkedInJob.salary?.min,
    payMax: linkedInJob.salary?.max,
    payCurrency: "USD",
    postedAt,
  };
}

/**
 * Ingests jobs from LinkedIn
 */
export async function ingestLinkedIn(
  location = "Phoenix, AZ",
  keyword?: string
): Promise<{
  fetched: number;
  normalized: number;
  created: number;
  updated: number;
  failed: number;
}> {
  console.log(`🔍 Scraping LinkedIn jobs for: ${location}${keyword ? ` (keyword: ${keyword})` : ""}`);

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
      headless: true, // Use headless mode
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-web-security",
        "--window-size=1920,1080",
      ],
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    
    // Set viewport to look more like a real browser
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Override webdriver property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
    });

    // Override chrome property
    await page.evaluateOnNewDocument(() => {
      (window as any).chrome = {
        runtime: {},
      };
    });

    // Override permissions
    await page.evaluateOnNewDocument(() => {
      const originalQuery = window.navigator.permissions.query;
      (window.navigator.permissions.query as any) = (parameters: any) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters);
    });

    // Add extra headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Cache-Control": "max-age=0",
    });

    // Scrape jobs
    const jobs = await scrapeLinkedInJobs(page, location, keyword, 25);
    stats.fetched = jobs.length;

    console.log(`   📥 Fetched ${jobs.length} jobs from LinkedIn`);
    
    // Debug: Check page state
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log(`   🔍 Current URL: ${currentUrl}`);
    console.log(`   🔍 Page title: ${pageTitle}`);
    
    if (currentUrl.includes("login") || currentUrl.includes("auth")) {
      console.warn("   ⚠️  LinkedIn redirected to login page. Scraping may require authentication.");
    }
    
    if (jobs.length === 0) {
      // Take screenshot for debugging
      try {
        await page.screenshot({ path: 'debug-linkedin.png', fullPage: true });
        console.log("   📸 Screenshot saved to debug-linkedin.png");
      } catch (e) {
        console.warn("   ⚠️  Could not save screenshot");
      }
    }

    // Normalize and upsert each job
    for (const job of jobs) {
      try {
        const normalized = await normalizeLinkedInJob(job);
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
      `   ✅ LinkedIn: ${stats.created} created, ${stats.updated} updated, ${stats.failed} failed`
    );
  } catch (error) {
    console.error("❌ LinkedIn ingestion failed:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return stats;
}

