// Common API response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: ErrorDetail;
  meta?: ResponseMeta;
}

export interface ErrorDetail {
  code: string;
  message: string;
  details?: any;
}

export interface ResponseMeta {
  requestId: string;
  timestamp: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Error response type
export interface ErrorResponse {
  error: ErrorDetail;
  timestamp: string;
  path: string;
  requestId: string;
}

// Request context
export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  startTime: number;
  userAgent?: string;
  ipAddress?: string;
}

// Query parameters for data filtering
export interface QueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  filter?: Record<string, any>;
  select?: string[];
}

// Health check response
export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
  checks?: Record<string, 'ok' | 'error'>;
}