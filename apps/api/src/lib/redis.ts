import Redis from "ioredis";

let redis: Redis | null = null;

/**
 * Initialize Redis connection
 * Returns null if Redis is not configured (app will work without it)
 */
export function initRedis(): Redis | null {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn("⚠️  REDIS_URL not set. Caching disabled.");
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError(err) {
        const targetError = "READONLY";
        if (err.message.includes(targetError)) {
          return true; // Reconnect on READONLY error
        }
        return false;
      },
    });

    redis.on("error", (err) => {
      console.error("Redis connection error:", err);
    });

    redis.on("connect", () => {
      console.log("✅ Redis connected");
    });

    return redis;
  } catch (error) {
    console.error("Failed to initialize Redis:", error);
    return null;
  }
}

/**
 * Get Redis instance (may be null if not configured)
 */
export function getRedis(): Redis | null {
  return redis;
}

/**
 * Generate cache key from search parameters
 */
export function getCacheKey(prefix: string, params: Record<string, any>): string {
  // Sort params for consistent keys
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}:${JSON.stringify(params[key])}`)
    .join("|");
  
  return `${prefix}:${sortedParams}`;
}

/**
 * Get cached value
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redis) return null;

  try {
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn("Cache get error:", error);
    return null;
  }
}

/**
 * Set cached value with TTL (time to live in seconds)
 */
export async function setCache(
  key: string,
  value: any,
  ttl: number = 300 // Default 5 minutes
): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("Cache set error:", error);
    return false;
  }
}

/**
 * Delete cached value
 */
export async function deleteCache(key: string): Promise<boolean> {
  if (!redis) return false;

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.warn("Cache delete error:", error);
    return false;
  }
}

/**
 * Delete all cache keys matching a pattern
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  if (!redis) return 0;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;
    
    await redis.del(...keys);
    return keys.length;
  } catch (error) {
    console.warn("Cache pattern delete error:", error);
    return 0;
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}




