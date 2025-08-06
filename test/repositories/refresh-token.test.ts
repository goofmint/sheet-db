/**
 * RefreshTokenRepository tests - comprehensive test coverage without mocking
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { RefreshTokenRepository } from '../../src/repositories/refresh-token';
import { refreshTokenTable, tokenAuditLogTable } from '../../src/db/schema';
import type { RefreshTokenInsert, TokenAuditLogInsert } from '../../src/db/schema';
import { env } from 'cloudflare:test';
import { setupRefreshTokenDatabase, setupTokenAuditLogDatabase } from '../utils/database-setup';

describe('RefreshTokenRepository', () => {
  let db: ReturnType<typeof drizzle>;
  let repository: RefreshTokenRepository;

  beforeEach(async () => {
    db = drizzle(env.DB);
    repository = new RefreshTokenRepository(db);
    
    // Setup database tables
    await setupRefreshTokenDatabase(db);
    await setupTokenAuditLogDatabase(db);
  });

  describe('create', () => {
    it('should create a new refresh token', async () => {
      const tokenData: RefreshTokenInsert = {
        token_id: 'test-token-id',
        user_id: 'test-user',
        refresh_token: 'test-refresh-token',
        ip_address: '127.0.0.1',
        user_agent: 'Test Agent'
      };

      const result = await repository.create(tokenData);

      expect(result).toBeDefined();
      expect(result?.token_id).toBe('test-token-id');
      expect(result?.user_id).toBe('test-user');
      expect(result?.refresh_token).toBe('test-refresh-token');
      expect(result?.is_revoked).toBe(0);
      expect(result?.used_at).toBeNull();
    });

    it('should create refresh token with minimal data', async () => {
      const tokenData: RefreshTokenInsert = {
        token_id: 'minimal-token',
        user_id: 'minimal-user',
        refresh_token: 'minimal-refresh-token'
      };

      const result = await repository.create(tokenData);

      expect(result).toBeDefined();
      expect(result?.token_id).toBe('minimal-token');
      expect(result?.ip_address).toBeNull();
      expect(result?.user_agent).toBeNull();
    });
  });

  describe('findValidByTokenId', () => {
    it('should find valid unused token', async () => {
      const tokenData: RefreshTokenInsert = {
        token_id: 'valid-token',
        user_id: 'test-user',
        refresh_token: 'test-refresh-token'
      };

      await repository.create(tokenData);
      const result = await repository.findValidByTokenId('valid-token');

      expect(result).toBeDefined();
      expect(result?.token_id).toBe('valid-token');
      expect(result?.is_revoked).toBe(0);
      expect(result?.used_at).toBeNull();
    });

    it('should not find used token', async () => {
      const tokenData: RefreshTokenInsert = {
        token_id: 'used-token',
        user_id: 'test-user',
        refresh_token: 'test-refresh-token'
      };

      const created = await repository.create(tokenData);
      expect(created).toBeDefined();

      // Mark as used
      await repository.markAsUsed('used-token');
      
      const result = await repository.findValidByTokenId('used-token');
      expect(result).toBeNull();
    });

    it('should not find revoked token', async () => {
      const tokenData: RefreshTokenInsert = {
        token_id: 'revoked-token',
        user_id: 'test-user',
        refresh_token: 'test-refresh-token'
      };

      await repository.create(tokenData);
      await repository.revoke('revoked-token');
      
      const result = await repository.findValidByTokenId('revoked-token');
      expect(result).toBeNull();
    });

    it('should not find non-existent token', async () => {
      const result = await repository.findValidByTokenId('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('findByTokenId', () => {
    it('should find token regardless of status', async () => {
      const tokenData: RefreshTokenInsert = {
        token_id: 'any-status-token',
        user_id: 'test-user',
        refresh_token: 'test-refresh-token'
      };

      await repository.create(tokenData);
      await repository.revoke('any-status-token');
      
      const result = await repository.findByTokenId('any-status-token');
      expect(result).toBeDefined();
      expect(result?.is_revoked).toBe(1);
    });
  });

  describe('markAsUsed', () => {
    it('should mark token as used', async () => {
      const tokenData: RefreshTokenInsert = {
        token_id: 'to-use-token',
        user_id: 'test-user',
        refresh_token: 'test-refresh-token'
      };

      await repository.create(tokenData);
      const result = await repository.markAsUsed('to-use-token');

      expect(result).toBeDefined();
      expect(result?.used_at).not.toBeNull();
      expect(new Date(result?.used_at || '').getTime()).toBeGreaterThan(0);
    });

    it('should return null for non-existent token', async () => {
      const result = await repository.markAsUsed('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('revoke', () => {
    it('should revoke token', async () => {
      const tokenData: RefreshTokenInsert = {
        token_id: 'to-revoke-token',
        user_id: 'test-user',
        refresh_token: 'test-refresh-token'
      };

      await repository.create(tokenData);
      const result = await repository.revoke('to-revoke-token');

      expect(result).toBeDefined();
      expect(result?.is_revoked).toBe(1);
      expect(result?.used_at).not.toBeNull();
    });
  });

  describe('revokeAllForUser', () => {
    it('should revoke all tokens for a user', async () => {
      // Create multiple tokens for same user
      const tokens = [
        { token_id: 'user-token-1', user_id: 'bulk-user', refresh_token: 'token1' },
        { token_id: 'user-token-2', user_id: 'bulk-user', refresh_token: 'token2' },
        { token_id: 'other-token', user_id: 'other-user', refresh_token: 'token3' }
      ];

      for (const token of tokens) {
        await repository.create(token);
      }

      const revokedCount = await repository.revokeAllForUser('bulk-user');
      expect(revokedCount).toBe(2);

      // Check that bulk-user tokens are revoked
      const userToken1 = await repository.findByTokenId('user-token-1');
      const userToken2 = await repository.findByTokenId('user-token-2');
      const otherToken = await repository.findByTokenId('other-token');

      expect(userToken1?.is_revoked).toBe(1);
      expect(userToken2?.is_revoked).toBe(1);
      expect(otherToken?.is_revoked).toBe(0); // Should not be affected
    });
  });

  describe('checkTokenReuse', () => {
    it('should detect token reuse', async () => {
      const tokenData: RefreshTokenInsert = {
        token_id: 'reuse-token',
        user_id: 'test-user',
        refresh_token: 'test-refresh-token'
      };

      await repository.create(tokenData);
      
      // Initially not used
      expect(await repository.checkTokenReuse('reuse-token')).toBe(false);
      
      // Mark as used
      await repository.markAsUsed('reuse-token');
      
      // Now should detect reuse
      expect(await repository.checkTokenReuse('reuse-token')).toBe(true);
    });

    it('should return false for non-existent token', async () => {
      expect(await repository.checkTokenReuse('non-existent')).toBe(false);
    });
  });

  describe('createAuditLog', () => {
    it('should create audit log entry', async () => {
      const logData: TokenAuditLogInsert = {
        token_id: 'audit-token',
        user_id: 'audit-user',
        event_type: 'created',
        ip_address: '192.168.1.1',
        user_agent: 'Audit Agent',
        details: 'Test audit entry'
      };

      const result = await repository.createAuditLog(logData);

      expect(result).toBeDefined();
      expect(result?.token_id).toBe('audit-token');
      expect(result?.event_type).toBe('created');
      expect(result?.details).toBe('Test audit entry');
    });

    it('should create audit log with all event types', async () => {
      const eventTypes: ('created' | 'used' | 'reused' | 'revoked')[] = 
        ['created', 'used', 'reused', 'revoked'];

      for (const eventType of eventTypes) {
        const logData: TokenAuditLogInsert = {
          token_id: `${eventType}-token`,
          user_id: 'test-user',
          event_type: eventType
        };

        const result = await repository.createAuditLog(logData);
        expect(result?.event_type).toBe(eventType);
      }
    });
  });

  describe('getAuditLogsForUser', () => {
    beforeEach(async () => {
      // Create test audit logs
      const logs = [
        { token_id: 'token1', user_id: 'target-user', event_type: 'created' as const },
        { token_id: 'token2', user_id: 'target-user', event_type: 'used' as const },
        { token_id: 'token3', user_id: 'other-user', event_type: 'created' as const }
      ];

      for (const log of logs) {
        await repository.createAuditLog(log);
      }
    });

    it('should get audit logs for specific user', async () => {
      const logs = await repository.getAuditLogsForUser('target-user');
      
      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.user_id === 'target-user')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const logs = await repository.getAuditLogsForUser('target-user', 1);
      expect(logs).toHaveLength(1);
    });

    it('should return empty array for user with no logs', async () => {
      const logs = await repository.getAuditLogsForUser('no-logs-user');
      expect(logs).toHaveLength(0);
    });
  });

  describe('getSuspiciousActivities', () => {
    it('should get reuse events', async () => {
      const logs = [
        { token_id: 'token1', user_id: 'user1', event_type: 'created' as const },
        { token_id: 'token2', user_id: 'user2', event_type: 'reused' as const },
        { token_id: 'token3', user_id: 'user3', event_type: 'reused' as const }
      ];

      for (const log of logs) {
        await repository.createAuditLog(log);
      }

      const suspicious = await repository.getSuspiciousActivities();
      expect(suspicious).toHaveLength(2);
      expect(suspicious.every(log => log.event_type === 'reused')).toBe(true);
    });
  });

  describe('getTokenStats', () => {
    beforeEach(async () => {
      // Create diverse token states
      const tokens = [
        { token_id: 'active1', user_id: 'stats-user', refresh_token: 'token1' },
        { token_id: 'active2', user_id: 'stats-user', refresh_token: 'token2' },
        { token_id: 'used1', user_id: 'stats-user', refresh_token: 'token3' },
        { token_id: 'revoked1', user_id: 'stats-user', refresh_token: 'token4' },
        { token_id: 'other-active', user_id: 'other-user', refresh_token: 'token5' }
      ];

      for (const token of tokens) {
        await repository.create(token);
      }

      // Modify states
      await repository.markAsUsed('used1');
      await repository.revoke('revoked1');
    });

    it('should get stats for specific user', async () => {
      const stats = await repository.getTokenStats('stats-user');
      
      expect(stats.total).toBe(4);
      expect(stats.active).toBe(2); // active1, active2
      expect(stats.used).toBe(1);   // used1
      expect(stats.revoked).toBe(1); // revoked1
    });

    it('should get global stats when no user specified', async () => {
      const stats = await repository.getTokenStats();
      
      expect(stats.total).toBe(5); // All tokens including other-user
      expect(stats.active).toBe(3); // active1, active2, other-active
      expect(stats.used).toBe(1);   // used1
      expect(stats.revoked).toBe(1); // revoked1
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should clean up old revoked and used tokens', async () => {
      // Create tokens with different states
      const tokens = [
        { token_id: 'fresh-active', user_id: 'cleanup-user', refresh_token: 'token1' },
        { token_id: 'old-revoked', user_id: 'cleanup-user', refresh_token: 'token2' },
        { token_id: 'old-used', user_id: 'cleanup-user', refresh_token: 'token3' }
      ];

      for (const token of tokens) {
        await repository.create(token);
      }

      // Mark some as revoked/used
      await repository.revoke('old-revoked');
      await repository.markAsUsed('old-used');

      // Manually update created_at to simulate old tokens
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days ago
      const oldDateISO = oldDate.toISOString();

      await db.update(refreshTokenTable)
        .set({ created_at: oldDateISO });

      // Clean up tokens older than 30 days
      const cleanedCount = await repository.cleanupExpiredTokens(30);
      
      expect(cleanedCount).toBe(2); // old-revoked and old-used should be deleted

      // Verify remaining tokens
      const remaining = await repository.findByTokenId('fresh-active');
      expect(remaining).toBeDefined(); // Should still exist (active tokens not cleaned)
      
      const deletedRevoked = await repository.findByTokenId('old-revoked');
      const deletedUsed = await repository.findByTokenId('old-used');
      expect(deletedRevoked).toBeNull();
      expect(deletedUsed).toBeNull();
    });
  });
});