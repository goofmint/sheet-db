// Cache entry from D1 Cache table
export interface CacheEntry {
  id: number;
  url: string; // normalized URL with sorted query parameters
  data: string; // JSON stringified data
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

// Cache key generation parameters
export interface CacheKeyParams {
  path: string;
  queryParams?: Record<string, any>;
  userId?: string;
}

// Cache operation result
export interface CacheResult<T = any> {
  hit: boolean;
  data?: T;
  entry?: CacheEntry;
  expired?: boolean;
}

// Cache statistics
export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  expiredEntries: number;
  lastUpdated: Date;
}