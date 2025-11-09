/**
 * ScraperAPI integration for bypassing Cloudflare and anti-bot protections
 * 
 * To use ScraperAPI:
 * 1. Sign up at https://www.scraperapi.com/
 * 2. Get your API key
 * 3. Add SCRAPERAPI_KEY to your .env file
 * 
 * Free tier: 1,000 requests/month
 * Paid plans start at $49/month for 100k requests
 */

export interface ScraperAPIOptions {
  apiKey: string;
  url: string;
  render?: boolean; // Use JavaScript rendering (slower but handles SPAs)
  countryCode?: string; // US, GB, etc.
  premium?: boolean; // Use premium proxies
  sessionNumber?: number; // Session persistence
}

/**
 * Fetches a URL through ScraperAPI proxy
 */
export async function fetchViaScraperAPI(options: ScraperAPIOptions): Promise<string> {
  const { apiKey, url, render = true, countryCode = "us", premium = false, sessionNumber } = options;

  const params = new URLSearchParams({
    api_key: apiKey,
    url: url,
    render: render.toString(),
    country_code: countryCode,
  });

  if (premium) {
    params.append("premium", "true");
  }

  if (sessionNumber) {
    params.append("session_number", sessionNumber.toString());
  }

  const apiUrl = `http://api.scraperapi.com/?${params.toString()}`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ScraperAPI error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown error fetching via ScraperAPI");
  }
}

/**
 * Checks if ScraperAPI is configured
 */
export function isScraperAPIConfigured(): boolean {
  return !!process.env.SCRAPERAPI_KEY;
}

/**
 * Gets ScraperAPI key from environment
 */
export function getScraperAPIKey(): string | null {
  return process.env.SCRAPERAPI_KEY || null;
}

