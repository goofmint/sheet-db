/**
 * Session management type definitions
 */

export interface Auth0UserData {
  auth0_user_id: string;
  sub: string;
}

export interface Auth0FullUserProfile {
  auth0_user_id: string;
  email: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
  sub: string;
}

export interface SessionCreateResult {
  success: boolean;
  session_id?: string;
  expires_at?: string;
  error?: string;
}

export interface SessionValidationResult {
  valid: boolean;
  user_data?: Auth0UserData;
  session_id?: string;
  expires_at?: string;
  error?: string;
}

export interface SessionRefreshResult {
  success: boolean;
  new_expires_at?: string;
  error?: string;
}

export interface RefreshTokenData {
  refresh_token: string;
  token_id: string;
  user_id: string;
  created_at: string;
  used_at?: string;
  is_revoked: boolean;
  ip_address?: string;
  user_agent?: string;
}

export interface RefreshTokenCreateResult {
  success: boolean;
  token_id?: string;
  error?: string;
}

export interface RefreshTokenValidationResult {
  valid: boolean;
  token_data?: RefreshTokenData;
  error?: string;
  is_reused?: boolean;
}

export interface RefreshTokenRevokeResult {
  success: boolean;
  revoked_count?: number;
  error?: string;
}

export interface TokenAuditLogEntry {
  token_id: string;
  user_id: string;
  event_type: 'created' | 'used' | 'reused' | 'revoked';
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
  details?: string;
}