# Job Ingestion System

This document explains how to pull jobs from LinkedIn, Indeed, and ZipRecruiter into the JobMap database.

## Overview

The ingestion system uses Puppeteer to scrape job listings from major job boards. Jobs are automatically geocoded, normalized, and stored in the database.

## Prerequisites

1. **Database Migration**: Run the migration to add new job sources:
   ```bash
   cd apps/api
   pnpm prisma migrate deploy
   ```

2. **Environment Variables**: Ensure you have:
   - `MAPBOX_TOKEN` - For geocoding job locations
   - `ADMIN_KEY` - (Optional) For API endpoint access

## Usage

### Command Line

#### Ingest from all sources:
```bash
cd apps/api
pnpm ingest:all [location] [keyword]
```

Examples:
```bash
# Ingest all sources for Phoenix, AZ
pnpm ingest:all "Phoenix, AZ"

# Ingest all sources for a specific location and keyword
pnpm ingest:all "Phoenix, AZ" "software engineer"

# Use default location (Phoenix, AZ)
pnpm ingest:all
```

#### Ingest from specific sources:
```bash
# LinkedIn
pnpm ingest:linkedin "Phoenix, AZ" "software engineer"

# Indeed
pnpm ingest:indeed "Phoenix, AZ" "software engineer"

# ZipRecruiter
pnpm ingest:ziprecruiter "Phoenix, AZ" "software engineer"
```

### API Endpoint

You can trigger ingestion via the admin API:

```bash
POST /v1/admin/ingest
Headers:
  x-admin-key: <your-admin-key>
Body:
  {
    "location": "Phoenix, AZ",  // Optional, defaults to "Phoenix, AZ"
    "keyword": "software engineer",  // Optional
    "sources": ["linkedin", "indeed", "ziprecruiter"]  // Optional, if omitted runs all sources
  }
```

Example with curl:
```bash
curl -X POST http://localhost:4000/v1/admin/ingest \
  -H "Content-Type: application/json" \
  -H "x-admin-key: your-admin-key" \
  -d '{
    "location": "Phoenix, AZ",
    "keyword": "software engineer",
    "sources": ["linkedin", "indeed"]
  }'
```

## How It Works

1. **Scraping**: Uses Puppeteer to load job search pages and extract job listings
2. **Geocoding**: Automatically geocodes job locations using Mapbox
3. **Normalization**: Converts job data to our standard format
4. **Deduplication**: Uses `(source, sourceId)` unique constraint to prevent duplicates
5. **Upsert**: Creates new jobs or updates existing ones

## Rate Limiting

The scrapers include built-in rate limiting:
- 2 second delay between page loads
- 500ms delay between job detail fetches
- Proper user-agent headers to avoid detection

## Important Notes

⚠️ **Terms of Service**: Web scraping may violate the Terms of Service of these platforms. Use responsibly and consider:
- Using official APIs when available
- Respecting rate limits
- Using proxies/VPNs if needed
- Checking ToS before production use

⚠️ **Performance**: Scraping can be slow (several minutes for 25 jobs per source) because:
- Each job description requires a separate page load
- Rate limiting delays between requests
- Geocoding API calls for each job

## Troubleshooting

### Puppeteer Issues
If Puppeteer fails to launch:
- Ensure Chrome/Chromium is installed
- Check system dependencies
- Try running with `headless: false` for debugging

### Geocoding Failures
If jobs fail to geocode:
- Verify `MAPBOX_TOKEN` is set
- Check Mapbox API quota
- Review location format (should be "City, State" or similar)

### No Jobs Found
- Verify the location format is correct
- Check if the job boards have jobs for that location
- Review browser console logs for errors

## Automation

You can set up automated ingestion using cron jobs or scheduled tasks:

```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/apps/api && pnpm ingest:all "Phoenix, AZ"
```

Or use a job scheduler like:
- GitHub Actions
- AWS Lambda + EventBridge
- Cron jobs on your server

