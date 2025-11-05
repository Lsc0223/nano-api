import config from '../utils/config';
import logger from '../utils/logger';

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
  requests: number[];
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();

  parseRateLimit(rateLimitStr: string): { limit: number; windowMs: number } {
    const match = rateLimitStr.match(/^(\d+)\/(min|hour|day|month|year)$/);
    if (!match) {
      logger.warn(`Invalid rate limit format: ${rateLimitStr}, using default 60/min`);
      return { limit: 60, windowMs: 60000 };
    }

    const limit = parseInt(match[1]);
    const unit = match[2];

    const windowMs = {
      min: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    }[unit] || 60000;

    return { limit, windowMs };
  }

  async checkRateLimit(apiKey: string): Promise<boolean> {
    const keyConfig = config.getApiKeyConfig(apiKey);
    if (!keyConfig) return false;

    const { limit, windowMs } = this.parseRateLimit(keyConfig.rateLimit);
    const now = Date.now();

    let entry = this.limits.get(apiKey);
    if (!entry) {
      entry = {
        tokens: limit,
        lastRefill: now,
        requests: [],
      };
      this.limits.set(apiKey, entry);
    }

    entry.requests = entry.requests.filter(timestamp => now - timestamp < windowMs);

    if (entry.requests.length >= limit) {
      logger.warn(`Rate limit exceeded for API key: ${apiKey}`);
      return false;
    }

    entry.requests.push(now);
    return true;
  }

  getRateLimitInfo(apiKey: string): { limit: number; remaining: number; reset: number } {
    const keyConfig = config.getApiKeyConfig(apiKey);
    if (!keyConfig) {
      return { limit: 0, remaining: 0, reset: Date.now() };
    }

    const { limit, windowMs } = this.parseRateLimit(keyConfig.rateLimit);
    const now = Date.now();

    const entry = this.limits.get(apiKey);
    if (!entry) {
      return { limit, remaining: limit, reset: now + windowMs };
    }

    entry.requests = entry.requests.filter(timestamp => now - timestamp < windowMs);
    const remaining = Math.max(0, limit - entry.requests.length);
    const oldestRequest = entry.requests[0] || now;
    const reset = oldestRequest + windowMs;

    return { limit, remaining, reset };
  }

  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;

    for (const [key, entry] of this.limits.entries()) {
      if (now - entry.lastRefill > maxAge && entry.requests.length === 0) {
        this.limits.delete(key);
      }
    }
  }
}

export default new RateLimiter();

setInterval(() => {
  new RateLimiter().cleanup();
}, 60 * 60 * 1000);
