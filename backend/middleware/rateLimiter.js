/**
 * Custom Rate Limiter Middleware
 * Implements Token Bucket Algorithm
 * 
 * Features:
 * - Per-IP rate limiting
 * - Configurable window and max requests
 * - Memory-efficient cleanup of expired buckets
 * - No third-party dependencies
 */

class RateLimiter {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes default
        this.maxRequests = options.maxRequests || 100;
        this.buckets = new Map(); // Store: IP -> { tokens: number, lastRefill: timestamp }

        // Cleanup expired buckets every 5 minutes to prevent memory leaks
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }

    /**
     * Get client IP address from request
     */
    getClientIP(req) {
        return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
            req.headers['x-real-ip'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            'unknown';
    }

    /**
     * Refill tokens based on time elapsed
     */
    refillTokens(bucket) {
        const now = Date.now();
        const timePassed = now - bucket.lastRefill;

        // Calculate tokens to add based on time passed
        const tokensToAdd = Math.floor((timePassed / this.windowMs) * this.maxRequests);

        if (tokensToAdd > 0) {
            bucket.tokens = Math.min(this.maxRequests, bucket.tokens + tokensToAdd);
            bucket.lastRefill = now;
        }

        return bucket;
    }

    /**
     * Check if request should be allowed
     */
    consume(ip) {
        const now = Date.now();

        // Get or create bucket for this IP
        let bucket = this.buckets.get(ip);

        if (!bucket) {
            bucket = {
                tokens: this.maxRequests - 1, // Consume one token immediately
                lastRefill: now,
                firstRequest: now
            };
            this.buckets.set(ip, bucket);
            return { allowed: true, remaining: bucket.tokens };
        }

        // Refill tokens based on time passed
        bucket = this.refillTokens(bucket);

        // Check if tokens available
        if (bucket.tokens > 0) {
            bucket.tokens--;
            this.buckets.set(ip, bucket);
            return { allowed: true, remaining: bucket.tokens };
        }

        // No tokens available
        const resetTime = bucket.lastRefill + this.windowMs;
        return {
            allowed: false,
            remaining: 0,
            resetTime: new Date(resetTime)
        };
    }

    /**
     * Cleanup expired buckets to prevent memory leaks
     */
    cleanup() {
        const now = Date.now();
        const expiryTime = this.windowMs * 2; // Keep buckets for 2x window time

        let cleaned = 0;
        for (const [ip, bucket] of this.buckets.entries()) {
            if (now - bucket.lastRefill > expiryTime) {
                this.buckets.delete(ip);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Rate limiter cleanup: removed ${cleaned} expired buckets`);
        }
    }

    /**
     * Get current stats
     */
    getStats() {
        return {
            activeBuckets: this.buckets.size,
            windowMs: this.windowMs,
            maxRequests: this.maxRequests
        };
    }

    /**
     * Destroy the rate limiter and cleanup
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.buckets.clear();
    }
}

/**
 * Express middleware factory
 */
function createRateLimiter(options = {}) {
    const limiter = new RateLimiter(options);

    return (req, res, next) => {
        const ip = limiter.getClientIP(req);
        const result = limiter.consume(ip);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', limiter.maxRequests);
        res.setHeader('X-RateLimit-Remaining', result.remaining);

        if (!result.allowed) {
            res.setHeader('X-RateLimit-Reset', result.resetTime.toISOString());
            res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));

            return res.status(429).json({
                error: 'Too Many Requests',
                message: `Rate limit exceeded. Try again after ${result.resetTime.toISOString()}`,
                retryAfter: result.resetTime
            });
        }

        next();
    };
}

module.exports = { RateLimiter, createRateLimiter };
