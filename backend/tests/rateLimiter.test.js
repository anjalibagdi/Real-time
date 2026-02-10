const { RateLimiter } = require('../middleware/rateLimiter');

describe('Rate Limiter', () => {
    let rateLimiter;

    beforeEach(() => {
        rateLimiter = new RateLimiter({
            windowMs: 1000, // 1 second for testing
            maxRequests: 5
        });
    });

    afterEach(() => {
        rateLimiter.destroy();
    });

    test('should allow requests within limit', () => {
        const ip = '192.168.1.1';

        for (let i = 0; i < 5; i++) {
            const result = rateLimiter.consume(ip);
            expect(result.allowed).toBe(true);
            expect(result.remaining).toBe(4 - i);
        }
    });

    test('should block requests exceeding limit', () => {
        const ip = '192.168.1.2';

        // Consume all tokens
        for (let i = 0; i < 5; i++) {
            rateLimiter.consume(ip);
        }

        // Next request should be blocked
        const result = rateLimiter.consume(ip);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.resetTime).toBeInstanceOf(Date);
    });

    test('should track different IPs separately', () => {
        const ip1 = '192.168.1.3';
        const ip2 = '192.168.1.4';

        // Consume tokens for IP1
        for (let i = 0; i < 5; i++) {
            rateLimiter.consume(ip1);
        }

        // IP2 should still have tokens
        const result = rateLimiter.consume(ip2);
        expect(result.allowed).toBe(true);
    });

    test('should refill tokens after time window', async () => {
        const ip = '192.168.1.5';

        // Consume all tokens
        for (let i = 0; i < 5; i++) {
            rateLimiter.consume(ip);
        }

        // Should be blocked
        let result = rateLimiter.consume(ip);
        expect(result.allowed).toBe(false);

        // Wait for window to pass
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Should be allowed again
        result = rateLimiter.consume(ip);
        expect(result.allowed).toBe(true);
    });

    test('should cleanup expired buckets', () => {
        const ip1 = '192.168.1.6';
        const ip2 = '192.168.1.7';

        rateLimiter.consume(ip1);
        rateLimiter.consume(ip2);

        expect(rateLimiter.buckets.size).toBe(2);

        // Manually trigger cleanup
        rateLimiter.cleanup();

        // Buckets should still exist (not expired yet)
        expect(rateLimiter.buckets.size).toBe(2);
    });

    test('should return correct stats', () => {
        rateLimiter.consume('192.168.1.8');
        rateLimiter.consume('192.168.1.9');

        const stats = rateLimiter.getStats();
        expect(stats.activeBuckets).toBe(2);
        expect(stats.windowMs).toBe(1000);
        expect(stats.maxRequests).toBe(5);
    });
});
