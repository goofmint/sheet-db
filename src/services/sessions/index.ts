/**
 * Sessions module index - provides unified interface for session management
 * 
 * This module exports a unified SessionService interface that maintains backward compatibility
 * while internally using the split services for better organization and maintainability.
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { SessionManager } from './session-manager';
import { RefreshTokenService } from './refresh-token-service';
import { UserSessionService } from './user-session-service';
import type { 
  Auth0UserData, 
  Auth0FullUserProfile,
  SessionCreateResult, 
  SessionValidationResult, 
  SessionRefreshResult,
  RefreshTokenCreateResult,
  RefreshTokenValidationResult,
  RefreshTokenRevokeResult,
  TokenAuditLogEntry
} from '../../types/session';
import type { UserRecord } from '../../sheet/user';
import type { Env } from '../../types/env';

/**
 * Unified SessionService class that provides backward compatibility
 * and delegates to the appropriate split services
 */
export class SessionService {
  /**
   * Initialize all session-related services
   */
  static initialize(database: DrizzleD1Database): void {
    SessionManager.initialize(database);
    RefreshTokenService.initialize(database);
    UserSessionService.initialize(database);
  }

  /**
   * Check if SessionService is initialized
   */
  static isInitialized(): boolean {
    return SessionManager.isInitialized() && 
           RefreshTokenService.isInitialized() && 
           UserSessionService.isInitialized();
  }

  /**
   * Ensure SessionService is initialized
   */
  static ensureInitialized(): void {
    if (!this.isInitialized()) {
      throw new Error('SessionService must be initialized before use');
    }
  }

  // =============================================================================
  // SESSION MANAGEMENT - Delegated to SessionManager
  // =============================================================================

  /**
   * Create a new session for authenticated user and update _User sheet
   */
  static async createSession(
    userData: Auth0UserData, 
    env?: Env, 
    fullProfile?: Auth0FullUserProfile
  ): Promise<SessionCreateResult> {
    // If environment and full profile are provided, use UserSessionService
    if (env && fullProfile) {
      return await UserSessionService.createSessionWithUserUpdate(userData, env, fullProfile);
    }
    
    // Otherwise, use basic SessionManager
    return await SessionManager.createSession(userData);
  }

  /**
   * Validate session and return user data
   */
  static async validateSession(sessionId: string): Promise<SessionValidationResult> {
    return await SessionManager.validateSession(sessionId);
  }

  /**
   * Refresh session expiry time
   */
  static async refreshSession(sessionId: string): Promise<SessionRefreshResult> {
    return await SessionManager.refreshSession(sessionId);
  }

  /**
   * Delete session
   */
  static async deleteSession(sessionId: string): Promise<boolean> {
    return await SessionManager.deleteSession(sessionId);
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions(): Promise<number> {
    return await SessionManager.cleanupExpiredSessions();
  }

  /**
   * Validate session ID using constant-time comparison
   */
  static validateSessionId(providedId: string, storedId: string): boolean {
    return SessionManager.validateSessionId(providedId, storedId);
  }

  /**
   * Check if session exists and is valid (convenience method)
   */
  static async isValidSession(sessionId: string): Promise<boolean> {
    return await SessionManager.isValidSession(sessionId);
  }

  /**
   * Cleanup sessions for a specific user (keep only N most recent)
   */
  static async cleanupUserSessions(userId: string, keepCount: number = 5): Promise<number> {
    return await SessionManager.cleanupUserSessions(userId, keepCount);
  }

  /**
   * Get authentication data only (minimal identifiers from session)
   */
  static async getAuthData(sessionId: string): Promise<Auth0UserData | null> {
    return await SessionManager.getAuthData(sessionId);
  }

  // =============================================================================
  // USER DATA INTEGRATION - Delegated to UserSessionService
  // =============================================================================

  /**
   * Get user data from _User sheet based on session
   * Returns null if _User sheet data is not available
   */
  static async getUserData(sessionId: string, env?: Env): Promise<UserRecord | null> {
    return await UserSessionService.getUserDataWithFallback(sessionId, env);
  }

  // =============================================================================
  // REFRESH TOKEN MANAGEMENT - Delegated to RefreshTokenService
  // =============================================================================

  /**
   * Store refresh token with rotation support
   */
  static async storeRefreshToken(
    userId: string, 
    refreshToken: string, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<RefreshTokenCreateResult> {
    return await RefreshTokenService.storeRefreshToken(userId, refreshToken, ipAddress, userAgent);
  }

  /**
   * Validate refresh token with reuse detection
   */
  static async validateRefreshToken(
    tokenId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<RefreshTokenValidationResult> {
    return await RefreshTokenService.validateRefreshToken(tokenId, ipAddress, userAgent);
  }

  /**
   * Revoke refresh token
   */
  static async revokeRefreshToken(
    tokenId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<RefreshTokenRevokeResult> {
    return await RefreshTokenService.revokeRefreshToken(tokenId, ipAddress, userAgent);
  }

  /**
   * Revoke all refresh tokens for a user (security measure)
   */
  static async revokeAllRefreshTokensForUser(userId: string): Promise<RefreshTokenRevokeResult> {
    return await RefreshTokenService.revokeAllRefreshTokensForUser(userId);
  }

  /**
   * Get audit log entries for security monitoring
   */
  static async getTokenAuditLog(userId: string, limit: number = 100): Promise<TokenAuditLogEntry[]> {
    return await RefreshTokenService.getTokenAuditLog(userId, limit);
  }

  /**
   * Clean up expired refresh tokens
   */
  static async cleanupExpiredRefreshTokens(olderThanDays: number = 30): Promise<number> {
    return await RefreshTokenService.cleanupExpiredRefreshTokens(olderThanDays);
  }

  /**
   * Get token statistics for monitoring
   */
  static async getRefreshTokenStats(userId?: string): Promise<{
    total: number;
    active: number;
    used: number;
    revoked: number;
  }> {
    return await RefreshTokenService.getRefreshTokenStats(userId);
  }
}

// Export individual services for direct usage if needed
export { SessionManager } from './session-manager';
export { RefreshTokenService } from './refresh-token-service';
export { UserSessionService } from './user-session-service';

// Re-export types for convenience
export type {
  Auth0UserData,
  Auth0FullUserProfile,
  SessionCreateResult,
  SessionValidationResult,
  SessionRefreshResult,
  RefreshTokenCreateResult,
  RefreshTokenValidationResult,
  RefreshTokenRevokeResult,
  TokenAuditLogEntry
} from '../../types/session';
export type { UserRecord } from '../../sheet/user';