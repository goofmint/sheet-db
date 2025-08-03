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