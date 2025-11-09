# Redis Caching Setup

Redis caching has been integrated into the API to improve performance by caching job search results and suggestions.

## Free Tier Options

### Option 1: Upstash Redis (Recommended)
- **Free Tier**: 10,000 commands/day
- **Perfect for**: Small/medium projects
- **Setup**: 5 minutes
- **URL**: https://upstash.com/

### Option 2: Railway Redis
- **Free Tier**: 256MB storage
- **Perfect for**: Development and small projects
- **URL**: https://railway.app/

### Option 3: Local Redis (Development)
- **Install**: `docker run -d -p 6379:6379 redis:alpine`
- **Perfect for**: Local development
- **Connection**: `redis://localhost:6379`

## Setup Instructions

### 1. Create Upstash Redis Instance (Recommended)

1. Go to https://upstash.com/
2. Sign up for a free account
3. Create a new Redis database:
   - Choose a region close to your API
   - Select "Regional" (free tier)
4. Copy the **REST URL** - it looks like:
   ```
   redis://default:xxxxx@xxxxx.upstash.io:6379
   ```

### 2. Add Environment Variable

Add to your `.env` file (root or `apps/api/.env`):

```env
REDIS_URL=redis://default:xxxxx@xxxxx.upstash.io:6379
```

**Important**: Replace the URL with your actual Upstash Redis URL.

### 3. Verify Setup

1. Start your API server: `cd apps/api && pnpm dev`
2. You should see: `✅ Redis connected` in the logs
3. Make a job search request
4. Check the response headers - you'll see `X-Cache: MISS` on first request
5. Make the same request again - you'll see `X-Cache: HIT` (cached!)

## What Gets Cached

### Job Search Results (`/v1/jobs/search`)
- **Cache Duration**: 
  - 5 minutes (300s) for basic searches
  - 3 minutes (180s) for filtered searches (with keywords, company, pay filters)
- **Cache Key**: Based on all search parameters (bbox, filters, etc.)
- **Benefit**: Reduces database load for popular searches

### Search Suggestions (`/v1/jobs/suggestions`)
- **Cache Duration**: 1 hour (3600s)
- **Cache Key**: Based on query and type (title/company)
- **Benefit**: Suggestions don't change often, so longer cache is fine

## Cache Behavior

- **Cache Hit**: Response served from Redis (faster, no DB query)
- **Cache Miss**: Response fetched from database, then cached for future requests
- **Automatic Expiry**: Cached data expires after TTL (Time To Live)
- **Graceful Degradation**: If Redis is unavailable, the app works normally (just no caching)

## Cache Headers

The API adds `X-Cache` header to responses:
- `X-Cache: HIT` - Response served from cache
- `X-Cache: MISS` - Response fetched from database

## Performance Impact

**Without Redis:**
- Every search = Database query (~50-200ms)

**With Redis:**
- First search = Database query + cache write (~50-200ms)
- Cached searches = Redis read (~1-5ms) ⚡ **10-50x faster!**

## Cache Invalidation

Currently, caches expire automatically based on TTL. To manually clear cache:

```typescript
import { deleteCachePattern } from "./lib/redis";

// Clear all job search caches
await deleteCachePattern("jobs:search:*");

// Clear all suggestion caches
await deleteCachePattern("jobs:suggestions:*");
```

## Monitoring

### Upstash Dashboard
- View cache hit/miss rates
- Monitor command usage
- Check memory usage
- View latency metrics

### API Logs
- `✅ Redis connected` - Redis initialized successfully
- `⚠️  REDIS_URL not set. Caching disabled.` - Running without cache (still works!)

## Cost

**Free tier is sufficient for most projects:**
- Upstash: 10,000 commands/day is plenty for small/medium apps
- Only pay if you exceed (starts at $0.20/100k commands)
- You'll get warnings before hitting limits

## Troubleshooting

### Redis Not Connecting
- Check `REDIS_URL` is correct
- Verify Redis instance is running (Upstash dashboard)
- Check network/firewall settings

### Cache Not Working
- Check logs for Redis connection status
- Verify `X-Cache` header in responses
- Make sure `REDIS_URL` is set correctly

### High Memory Usage
- Reduce cache TTL times in `apps/api/src/routes/jobs.ts`
- Clear old cache patterns periodically
- Consider upgrading Redis plan if needed

## Disabling Redis

If you want to disable caching temporarily:
1. Remove or comment out `REDIS_URL` in `.env`
2. Restart API server
3. App will work normally, just without caching

## Resources

- [Upstash Redis](https://upstash.com/)
- [ioredis Documentation](https://github.com/redis/ioredis)
- [Redis Commands](https://redis.io/commands/)




