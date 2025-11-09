# ScraperAPI Setup Guide

ScraperAPI is a service that bypasses Cloudflare and other anti-bot protections automatically. It's perfect for scraping sites like Indeed, LinkedIn, and ZipRecruiter.

## Quick Start

### 1. Get Your Free API Key

1. Sign up at [https://www.scraperapi.com/](https://www.scraperapi.com/)
2. Get 1,000 free requests/month (perfect for testing)
3. Copy your API key from the dashboard

### 2. Add to Environment

Add to your `.env` file (in `apps/api/.env` or root `.env`):

```bash
SCRAPERAPI_KEY=your_api_key_here
```

### 3. Run Ingestion

```bash
# Use ScraperAPI version
pnpm ingest:indeed-api "Phoenix, AZ"

# Or run all (will auto-detect ScraperAPI)
pnpm ingest:all "Phoenix, AZ"
```

## Pricing

- **Free Tier**: 1,000 requests/month
- **Starter**: $49/month - 100,000 requests
- **Business**: $149/month - 500,000 requests
- **Enterprise**: Custom pricing

## How It Works

ScraperAPI acts as a proxy that:
- ✅ Bypasses Cloudflare automatically
- ✅ Handles CAPTCHAs
- ✅ Rotates IPs to avoid blocking
- ✅ Uses residential proxies
- ✅ Handles JavaScript rendering

## Usage

The system automatically detects if ScraperAPI is configured and uses it instead of direct scraping:

```typescript
if (isScraperAPIConfigured()) {
  // Use ScraperAPI
  await ingestIndeedViaScraperAPI(location, keyword);
} else {
  // Fall back to direct scraping
  await ingestIndeed(location, keyword);
}
```

## Alternative Services

If ScraperAPI doesn't work for you, consider:

1. **ScrapingBee** - Similar to ScraperAPI
   - Free: 1,000 requests/month
   - Paid: Starts at $49/month

2. **Apify** - Pre-built scrapers
   - Has actors for LinkedIn, Indeed, etc.
   - Pay per execution

3. **ZenRows** - All-in-one scraping API
   - Free: 1,000 requests/month
   - Paid: Starts at $29/month

## Testing

Test your ScraperAPI key:

```bash
# This will use ScraperAPI if configured
pnpm ingest:indeed-api "Phoenix, AZ"
```

If it works, you should see jobs being fetched successfully!

