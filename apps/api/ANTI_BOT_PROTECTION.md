# Anti-Bot Protection Techniques

This document explains the techniques we've implemented to overcome anti-scraping protections on LinkedIn, Indeed, and ZipRecruiter.

## Implemented Techniques

### 1. **Stealth Plugins**
- **puppeteer-extra-plugin-stealth**: Hides automation indicators
  - Removes `navigator.webdriver` property
  - Masks headless Chrome detection
  - Fixes plugin and permission issues
  - Patches Chrome runtime

- **puppeteer-extra-plugin-anonymize-ua**: Randomizes user agent strings

### 2. **Browser Configuration**
```javascript
{
  headless: "new",  // New headless mode (harder to detect)
  args: [
    "--disable-blink-features=AutomationControlled",  // Remove automation flags
    "--disable-features=IsolateOrigins,site-per-process",
    "--window-size=1920,1080",  // Realistic window size
  ]
}
```

### 3. **JavaScript Overrides**
- **Hide webdriver property**: `navigator.webdriver = false`
- **Add Chrome object**: `window.chrome = { runtime: {} }`
- **Fix permissions API**: Prevents detection via permission queries

### 4. **Human-like Behavior**
- **Random delays**: 1-4 seconds between actions
- **Gradual scrolling**: Scrolls slowly like a human reading
- **Realistic viewport**: 1920x1080 (common screen size)
- **Proper headers**: Accept-Language, Accept-Encoding, etc.

### 5. **Request Timing**
- Random delays between page loads (1-2 seconds)
- Random delays between job detail fetches (1-2 seconds)
- Gradual page scrolling instead of instant jumps

## Additional Techniques (Not Yet Implemented)

### 1. **Proxy Rotation**
```javascript
// Use rotating proxies to avoid IP-based blocking
const proxy = getRandomProxy();
await page.authenticate({ username: proxy.user, password: proxy.pass });
```

### 2. **Cookie/Session Management**
```javascript
// Save and reuse cookies from manual browser sessions
const cookies = await loadCookies();
await page.setCookie(...cookies);
```

### 3. **CAPTCHA Solving**
- Use services like 2Captcha or AntiCaptcha
- Or use browser automation tools that handle CAPTCHAs

### 4. **Residential Proxies**
- Use services like Bright Data, Smartproxy, or Oxylabs
- More expensive but harder to detect

### 5. **Browser Fingerprinting**
- Use tools like FingerprintJS to match real browser fingerprints
- Rotate fingerprints between requests

### 6. **Headless Detection Bypass**
```javascript
// Use non-headless mode with virtual display (Xvfb on Linux)
browser = await puppeteer.launch({
  headless: false,  // Visible browser
  args: ['--display=:99']  // Virtual display
});
```

## Debugging Tips

### Enable Screenshots
Add this to see what the scraper sees:
```javascript
await page.screenshot({ path: 'debug.png', fullPage: true });
```

### Check for Redirects
```javascript
const currentUrl = page.url();
if (currentUrl.includes('login') || currentUrl.includes('captcha')) {
  console.log('Blocked or redirected!');
}
```

### Monitor Network Requests
```javascript
page.on('request', request => console.log('Request:', request.url()));
page.on('response', response => console.log('Response:', response.status()));
```

## Common Blocking Scenarios

### 1. **Login Required**
- **Symptom**: Redirected to login page
- **Solution**: Use saved cookies or implement login automation

### 2. **CAPTCHA**
- **Symptom**: CAPTCHA appears
- **Solution**: Use CAPTCHA solving service or manual intervention

### 3. **Rate Limiting**
- **Symptom**: 429 Too Many Requests
- **Solution**: Increase delays, use proxies, reduce request frequency

### 4. **IP Blocking**
- **Symptom**: All requests fail or return empty results
- **Solution**: Use proxy rotation, change IP, wait for cooldown

### 5. **JavaScript Detection**
- **Symptom**: Page loads but no content
- **Solution**: Improve stealth plugins, check selectors

## Testing the Improvements

Run with debug mode:
```bash
# Test Indeed
pnpm ingest:indeed "Phoenix, AZ"

# Test LinkedIn  
pnpm ingest:linkedin "Phoenix, AZ"

# Test ZipRecruiter
pnpm ingest:ziprecruiter "Phoenix, AZ"
```

## If Still Blocked

### Option 1: Use Third-Party APIs
- **SerpAPI**: Handles scraping for you
- **Apify**: Pre-built scrapers
- **RapidAPI**: Job search APIs
- **ScraperAPI**: Proxy + scraping service

### Option 2: Manual Browser Sessions
1. Open browser manually
2. Login to the site
3. Export cookies
4. Use cookies in scraper

### Option 3: Selenium with Real Browser
- Use Selenium with real Chrome/Firefox
- Harder to detect than headless

### Option 4: Mobile App APIs
- Some sites have mobile apps with APIs
- Reverse engineer the mobile API
- Often less protected than web

## Legal Considerations

⚠️ **Important**: 
- Check Terms of Service before scraping
- Some sites explicitly prohibit scraping
- Use official APIs when available
- Consider rate limits and server load
- Respect robots.txt

## Next Steps

1. **Test current improvements** - Run scrapers and check results
2. **Add screenshot debugging** - See what pages actually load
3. **Implement proxy rotation** - If IP blocking occurs
4. **Add cookie management** - For sites requiring login
5. **Consider third-party APIs** - If direct scraping fails

