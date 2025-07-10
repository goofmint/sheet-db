/**
 * Simple rate limiter for Cloudflare Workers
 * Uses KV storage for distributed rate limiting
 */

import { logger } from './logger';

export interface RateLimitConfig {
	maxRequests: number;
	windowMs: number;
	keyPrefix?: string;
}

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetTime: number;
	error?: string;
}

export class RateLimiter {
	private config: RateLimitConfig;

	constructor(config: RateLimitConfig) {
		this.config = {
			keyPrefix: 'rate_limit',
			...config
		};
	}

	async checkRateLimit(identifier: string, kv?: KVNamespace): Promise<RateLimitResult> {
		try {
			// If no KV storage available, allow request (graceful degradation)
			if (!kv) {
				logger.warn('KV storage not available, allowing request', { identifier });
				return {
					allowed: true,
					remaining: this.config.maxRequests,
					resetTime: Date.now() + this.config.windowMs
				};
			}

			const key = `${this.config.keyPrefix}:${identifier}`;
			const now = Date.now();
			const windowStart = now - this.config.windowMs;

			// Get existing rate limit data
			const existingData = await kv.get(key);
			let requests: number[] = [];
			
			if (existingData) {
				try {
					const parsed = JSON.parse(existingData);
					requests = parsed.requests || [];
				} catch (error) {
					logger.error('Failed to parse rate limit data', { error, key });
					requests = [];
				}
			}

			// Remove old requests outside the window
			requests = requests.filter(timestamp => timestamp > windowStart);

			// Check if rate limit exceeded
			if (requests.length >= this.config.maxRequests) {
				const oldestRequest = Math.min(...requests);
				const resetTime = oldestRequest + this.config.windowMs;
				
				logger.warn('Rate limit exceeded', { 
					identifier, 
					requests: requests.length, 
					maxRequests: this.config.maxRequests,
					windowMs: this.config.windowMs
				});

				return {
					allowed: false,
					remaining: 0,
					resetTime,
					error: 'Rate limit exceeded'
				};
			}

			// Add current request
			requests.push(now);

			// Store updated data
			await kv.put(key, JSON.stringify({ requests }), {
				expirationTtl: Math.ceil(this.config.windowMs / 1000) + 10 // Add buffer
			});

			return {
				allowed: true,
				remaining: this.config.maxRequests - requests.length,
				resetTime: now + this.config.windowMs
			};

		} catch (error) {
			logger.error('Rate limiter error', { error, identifier });
			// On error, allow the request (fail open)
			return {
				allowed: true,
				remaining: this.config.maxRequests,
				resetTime: Date.now() + this.config.windowMs
			};
		}
	}
}

// Default rate limiter for data insertion
export const dataInsertionRateLimiter = new RateLimiter({
	maxRequests: 100, // 100 requests per window
	windowMs: 60 * 1000 // 1 minute window
});

// Stricter rate limiter for unauthenticated users
export const unauthenticatedRateLimiter = new RateLimiter({
	maxRequests: 10, // 10 requests per window
	windowMs: 60 * 1000 // 1 minute window
});