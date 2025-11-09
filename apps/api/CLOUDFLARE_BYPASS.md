# Cloudflare Bypass Guide

## The Problem

Many sites (including Indeed, LinkedIn, ZipRecruiter) use Cloudflare to protect against bots. When you see "Just a moment..." it means Cloudflare is challenging your browser.

## Current Implementation

We've added a wait function that checks if Cloudflare challenge has passed:
```javascript
await page.waitForFunction(
  () => document.title !== "Just a moment..." && !document.querySelector("#challenge-form"),
  { timeout: 15000 }
);
```

## Additional Solutions

### 1. **Use Cloudflare Bypass Libraries**

Install `puppeteer-extra-plugin-recaptcha`:
```bash
pnpm add puppeteer-extra-plugin-recaptcha
```

### 2. **Use Undetected Chrome**

Replace Puppeteer with `undetected-chromedriver`:
```bash
pnpm add undetected-chromedriver
```

### 3. **Use Residential Proxies**

Cloudflare often blocks datacenter IPs. Use residential proxies:
- Bright Data
- Smartproxy
- Oxylabs

### 4. **Manual Cookie Method**

1. Open browser manually
2. Navigate to site and complete Cloudflare challenge
3. Export cookies
4. Use cookies in scraper

### 5. **Use Cloudflare Bypass Services**

- **ScraperAPI**: Handles Cloudflare automatically
- **ScrapingBee**: Built-in Cloudflare bypass
- **ZenRows**: Cloudflare protection included

### 6. **Increase Wait Times**

Cloudflare challenges can take 5-10 seconds. Increase timeout:
```javascript
await page.waitForFunction(
  () => document.title !== "Just a moment...",
  { timeout: 30000 }  // 30 seconds
);
```

## Recommended Approach

For production, consider using a service that handles Cloudflare:
1. **ScraperAPI** - Simple API, handles Cloudflare
2. **ScrapingBee** - Similar to ScraperAPI
3. **Apify** - Pre-built actors for job sites

These services cost money but are more reliable than trying to bypass Cloudflare yourself.

