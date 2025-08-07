/**
 * RefreshTokenService provides OAuth 2.0 refresh token management
 * Handles token storage, validation, rotation, and security auditing
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { RefreshTokenRepository } from '../../repositories/refresh-token';
import type {
  RefreshTokenData,
  RefreshTokenCreateResult,
  RefreshTokenValidationResult,
  RefreshTokenRevokeResult,
  TokenAuditLogEntry
} from '../../types/session';

export class RefreshTokenService {
  private static refreshTokenRepository: RefreshTokenRepository;
  private static initialized = false;

  /**
   * Initialize RefreshTokenService with database connection
   */
  static initialize(database: DrizzleD1Database): void {
    this.refreshTokenRepository = new RefreshTokenRepository(database);
    this.initialized = true;
  }

  /**
   * Check if RefreshTokenService is initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Ensure RefreshTokenService is initialized
   */
  private static ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('RefreshTokenService must be initialized before use');
    }
  }

  /**
   * Store refresh token with rotation support
   */
  static async storeRefreshToken(
    userId: string, 
    refreshToken: string, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<RefreshTokenCreateResult> {
    this.ensureInitialized();

    try {
      // Generate unique token ID
      const tokenId = crypto.randomUUID();

      // Store refresh token
      const tokenData = await this.refreshTokenRepository.create({
        token_id: tokenId,
        user_id: userId,
        refresh_token: refreshToken,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      if (!tokenData) {
        return {
          success: false,
          error: 'Failed to store refresh token'
        };
      }

      // Create audit log
      await this.refreshTokenRepository.createAuditLog({
        token_id: tokenId,
        user_id: userId,
        event_type: 'created',
        ip_address: ipAddress,
        user_agent: userAgent,
        details: 'Refresh token created'
      });

      return {
        success: true,
        token_id: tokenId
      };

    } catch (error) {
      console.error('Failed to store refresh token:', error);
      return {
        success: false,
        error: 'Internal error storing refresh token'
      };
    }
  }

  /**
   * Validate refresh token with reuse detection
   */
  static async validateRefreshToken(
    tokenId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<RefreshTokenValidationResult> {
    this.ensureInitialized();

    try {
      // Check if token was already used (reuse detection)
      const wasUsed = await this.refreshTokenRepository.checkTokenReuse(tokenId);
      
      if (wasUsed) {
        // Token reuse detected - this is a security violation
        const tokenData = await this.refreshTokenRepository.findByTokenId(tokenId);
        
        if (tokenData) {
          // Log security event
          await this.refreshTokenRepository.createAuditLog({
            token_id: tokenId,
            user_id: tokenData.user_id,
            event_type: 'reused',
            ip_address: ipAddress,
            user_agent: userAgent,
            details: 'Token reuse detected - possible security breach'
          });

          // Revoke all tokens for this user as a security measure
          await this.revokeAllRefreshTokensForUser(tokenData.user_id);
        }

        return {
          valid: false,
          is_reused: true,
          error: 'Token reuse detected - all tokens revoked'
        };
      }

      // Find valid token
      const tokenData = await this.refreshTokenRepository.findValidByTokenId(tokenId);
      
      if (!tokenData) {
        return {
          valid: false,
          error: 'Refresh token not found or expired'
        };
      }

      // Mark token as used (one-time use)
      await this.refreshTokenRepository.markAsUsed(tokenId);

      // Create audit log for token use
      await this.refreshTokenRepository.createAuditLog({
        token_id: tokenId,
        user_id: tokenData.user_id,
        event_type: 'used',
        ip_address: ipAddress,
        user_agent: userAgent,
        details: 'Refresh token used successfully'
      });

      return {
        valid: true,
        token_data: {
          refresh_token: tokenData.refresh_token,
          token_id: tokenData.token_id,
          user_id: tokenData.user_id,
          created_at: tokenData.created_at || new Date().toISOString(),
          used_at: new Date().toISOString(),
          is_revoked: false,
          ip_address: ipAddress,
          user_agent: userAgent
        }
      };

    } catch (error) {
      console.error('Failed to validate refresh token:', error);
      return {
        valid: false,
        error: 'Internal error validating refresh token'
      };
    }
  }

  /**
   * Revoke refresh token
   */
  static async revokeRefreshToken(
    tokenId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<RefreshTokenRevokeResult> {
    this.ensureInitialized();

    try {
      const tokenData = await this.refreshTokenRepository.findByTokenId(tokenId);
      
      if (!tokenData) {
        return {
          success: false,
          error: 'Token not found'
        };
      }

      await this.refreshTokenRepository.revoke(tokenId);

      // Create audit log
      await this.refreshTokenRepository.createAuditLog({
        token_id: tokenId,
        user_id: tokenData.user_id,
        event_type: 'revoked',
        ip_address: ipAddress,
        user_agent: userAgent,
        details: 'Refresh token revoked'
      });

      return {
        success: true,
        revoked_count: 1
      };

    } catch (error) {
      console.error('Failed to revoke refresh token:', error);
      return {
        success: false,
        error: 'Internal error revoking refresh token'
      };
    }
  }

  /**
   * Revoke all refresh tokens for a user (security measure)
   */
  static async revokeAllRefreshTokensForUser(userId: string): Promise<RefreshTokenRevokeResult> {
    this.ensureInitialized();

    try {
      const revokedCount = await this.refreshTokenRepository.revokeAllForUser(userId);

      // Create audit log
      await this.refreshTokenRepository.createAuditLog({
        token_id: 'bulk-revoke',
        user_id: userId,
        event_type: 'revoked',
        details: `Bulk revocation of ${revokedCount} tokens`
      });

      return {
        success: true,
        revoked_count: revokedCount
      };

    } catch (error) {
      console.error('Failed to revoke all refresh tokens:', error);
      return {
        success: false,
        error: 'Internal error revoking tokens'
      };
    }
  }

  /**
   * Get audit log entries for security monitoring
   */
  static async getTokenAuditLog(userId: string, limit: number = 100): Promise<TokenAuditLogEntry[]> {
    this.ensureInitialized();

    try {
      const logs = await this.refreshTokenRepository.getAuditLogsForUser(userId, limit);
      
      return logs.map(log => ({
        token_id: log.token_id,
        user_id: log.user_id,
        event_type: log.event_type as 'created' | 'used' | 'reused' | 'revoked',
        ip_address: log.ip_address || undefined,
        user_agent: log.user_agent || undefined,
        timestamp: log.timestamp || new Date().toISOString(),
        details: log.details || undefined
      }));

    } catch (error) {
      console.error('Failed to get audit log:', error);
      return [];
    }
  }

  /**
   * Clean up expired refresh tokens
   */
  static async cleanupExpiredRefreshTokens(olderThanDays: number = 30): Promise<number> {
    this.ensureInitialized();

    try {
      return await this.refreshTokenRepository.cleanupExpiredTokens(olderThanDays);
    } catch (error) {
      console.error('Failed to cleanup expired refresh tokens:', error);
      return 0;
    }
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
    this.ensureInitialized();

    try {
      return await this.refreshTokenRepository.getTokenStats(userId);
    } catch (error) {
      console.error('Failed to get token stats:', error);
      return { total: 0, active: 0, used: 0, revoked: 0 };
    }
  }
}