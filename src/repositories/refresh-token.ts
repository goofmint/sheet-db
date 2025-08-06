/**
 * RefreshTokenRepository handles refresh token database operations
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, sql, desc } from 'drizzle-orm';
import { refreshTokenTable, tokenAuditLogTable } from '../db/schema';
import type { 
  RefreshToken, 
  RefreshTokenInsert, 
  RefreshTokenUpdate,
  TokenAuditLog,
  TokenAuditLogInsert
} from '../db/schema';

export class RefreshTokenRepository {
  constructor(private database: DrizzleD1Database) {}

  /**
   * Create a new refresh token
   */
  async create(data: RefreshTokenInsert): Promise<RefreshToken | null> {
    try {
      const result = await this.database
        .insert(refreshTokenTable)
        .values(data)
        .returning();
      
      return result[0] || null;
    } catch (error) {
      console.error('Failed to create refresh token:', error);
      return null;
    }
  }

  /**
   * Find valid refresh token by token ID
   */
  async findValidByTokenId(tokenId: string): Promise<RefreshToken | null> {
    try {
      const result = await this.database
        .select()
        .from(refreshTokenTable)
        .where(
          and(
            eq(refreshTokenTable.token_id, tokenId),
            eq(refreshTokenTable.is_revoked, 0),
            sql`${refreshTokenTable.used_at} IS NULL`
          )
        )
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('Failed to find refresh token:', error);
      return null;
    }
  }

  /**
   * Find refresh token by token ID (regardless of status)
   */
  async findByTokenId(tokenId: string): Promise<RefreshToken | null> {
    try {
      const result = await this.database
        .select()
        .from(refreshTokenTable)
        .where(eq(refreshTokenTable.token_id, tokenId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('Failed to find refresh token:', error);
      return null;
    }
  }

  /**
   * Mark refresh token as used
   */
  async markAsUsed(tokenId: string): Promise<RefreshToken | null> {
    try {
      const result = await this.database
        .update(refreshTokenTable)
        .set({ 
          used_at: new Date().toISOString()
        })
        .where(eq(refreshTokenTable.token_id, tokenId))
        .returning();

      return result[0] || null;
    } catch (error) {
      console.error('Failed to mark token as used:', error);
      return null;
    }
  }

  /**
   * Revoke refresh token
   */
  async revoke(tokenId: string): Promise<RefreshToken | null> {
    try {
      const result = await this.database
        .update(refreshTokenTable)
        .set({ 
          is_revoked: 1,
          used_at: new Date().toISOString()
        })
        .where(eq(refreshTokenTable.token_id, tokenId))
        .returning();

      return result[0] || null;
    } catch (error) {
      console.error('Failed to revoke token:', error);
      return null;
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllForUser(userId: string): Promise<number> {
    try {
      const result = await this.database
        .update(refreshTokenTable)
        .set({ 
          is_revoked: 1,
          used_at: new Date().toISOString()
        })
        .where(
          and(
            eq(refreshTokenTable.user_id, userId),
            eq(refreshTokenTable.is_revoked, 0)
          )
        )
        .returning();

      return result.length;
    } catch (error) {
      console.error('Failed to revoke all tokens for user:', error);
      return 0;
    }
  }

  /**
   * Clean up expired and used tokens
   */
  async cleanupExpiredTokens(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      const cutoffISOString = cutoffDate.toISOString();

      const result = await this.database
        .delete(refreshTokenTable)
        .where(
          and(
            sql`${refreshTokenTable.created_at} < ${cutoffISOString}`,
            sql`(${refreshTokenTable.is_revoked} = 1 OR ${refreshTokenTable.used_at} IS NOT NULL)`
          )
        )
        .returning();

      return result.length;
    } catch (error) {
      console.error('Failed to cleanup expired tokens:', error);
      return 0;
    }
  }

  /**
   * Create audit log entry
   */
  async createAuditLog(data: TokenAuditLogInsert): Promise<TokenAuditLog | null> {
    try {
      const result = await this.database
        .insert(tokenAuditLogTable)
        .values(data)
        .returning();
      
      return result[0] || null;
    } catch (error) {
      console.error('Failed to create audit log:', error);
      return null;
    }
  }

  /**
   * Get audit logs for a user
   */
  async getAuditLogsForUser(userId: string, limit: number = 100): Promise<TokenAuditLog[]> {
    try {
      return await this.database
        .select()
        .from(tokenAuditLogTable)
        .where(eq(tokenAuditLogTable.user_id, userId))
        .orderBy(desc(tokenAuditLogTable.timestamp))
        .limit(limit);
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit logs for suspicious activities
   */
  async getSuspiciousActivities(limit: number = 100): Promise<TokenAuditLog[]> {
    try {
      return await this.database
        .select()
        .from(tokenAuditLogTable)
        .where(eq(tokenAuditLogTable.event_type, 'reused'))
        .orderBy(desc(tokenAuditLogTable.timestamp))
        .limit(limit);
    } catch (error) {
      console.error('Failed to get suspicious activities:', error);
      return [];
    }
  }

  /**
   * Check if token was already used (for reuse detection)
   */
  async checkTokenReuse(tokenId: string): Promise<boolean> {
    try {
      const result = await this.database
        .select()
        .from(refreshTokenTable)
        .where(
          and(
            eq(refreshTokenTable.token_id, tokenId),
            sql`${refreshTokenTable.used_at} IS NOT NULL`
          )
        )
        .limit(1);

      return result.length > 0;
    } catch (error) {
      console.error('Failed to check token reuse:', error);
      return false;
    }
  }

  /**
   * Get token statistics for monitoring
   */
  async getTokenStats(userId?: string): Promise<{
    total: number;
    active: number;
    used: number;
    revoked: number;
  }> {
    try {
      const whereClause = userId ? eq(refreshTokenTable.user_id, userId) : undefined;
      
      const [totalResult] = await this.database
        .select({ count: sql<number>`count(*)` })
        .from(refreshTokenTable)
        .where(whereClause);

      const [activeResult] = await this.database
        .select({ count: sql<number>`count(*)` })
        .from(refreshTokenTable)
        .where(
          whereClause
            ? and(
                whereClause,
                eq(refreshTokenTable.is_revoked, 0),
                sql`${refreshTokenTable.used_at} IS NULL`
              )
            : and(
                eq(refreshTokenTable.is_revoked, 0),
                sql`${refreshTokenTable.used_at} IS NULL`
              )
        );

      const [usedResult] = await this.database
        .select({ count: sql<number>`count(*)` })
        .from(refreshTokenTable)
        .where(
          whereClause
            ? and(
                whereClause,
                eq(refreshTokenTable.is_revoked, 0),
                sql`${refreshTokenTable.used_at} IS NOT NULL`
              )
            : and(
                eq(refreshTokenTable.is_revoked, 0),
                sql`${refreshTokenTable.used_at} IS NOT NULL`
              )
        );

      const [revokedResult] = await this.database
        .select({ count: sql<number>`count(*)` })
        .from(refreshTokenTable)
        .where(
          whereClause
            ? and(whereClause, eq(refreshTokenTable.is_revoked, 1))
            : eq(refreshTokenTable.is_revoked, 1)
        );

      return {
        total: totalResult.count,
        active: activeResult.count,
        used: usedResult.count,
        revoked: revokedResult.count
      };
    } catch (error) {
      console.error('Failed to get token stats:', error);
      return { total: 0, active: 0, used: 0, revoked: 0 };
    }
  }
}