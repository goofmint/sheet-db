/**
 * Session Repository
 *
 * Manages user sessions in the user_sessions table
 * Handles session creation, retrieval, and cleanup
 */

import { eq, lt } from 'drizzle-orm';
import { createDbClient } from './client';
import { userSessions } from './schema';
import type { Env } from '../types/env';

export class SessionRepository {
  private db;

  constructor(env: Env) {
    this.db = createDbClient(env);
  }

  /**
   * Hash a session token using SHA-256
   * @param token - The plaintext session token
   * @returns Hex-encoded SHA-256 hash
   */
  private async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  /**
   * Create a new session
   */
  async createSession(
    sessionId: string,
    userId: string,
    expiresAt: Date
  ): Promise<void> {
    const tokenHash = await this.hashToken(sessionId);
    await this.db.insert(userSessions).values({
      token_hash: tokenHash,
      user_id: userId,
      expires_at: expiresAt,
    });
  }

  /**
   * Get session by session ID
   * Returns null if session doesn't exist or has expired
   */
  async getSession(sessionId: string): Promise<{ userId: string } | null> {
    const tokenHash = await this.hashToken(sessionId);
    const result = await this.db
      .select()
      .from(userSessions)
      .where(eq(userSessions.token_hash, tokenHash))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const session = result[0];

    // Check if session has expired
    if (session.expires_at < new Date()) {
      // Session expired, delete it
      await this.deleteSession(sessionId);
      return null;
    }

    return {
      userId: session.user_id,
    };
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const tokenHash = await this.hashToken(sessionId);
    await this.db
      .delete(userSessions)
      .where(eq(userSessions.token_hash, tokenHash));
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string): Promise<void> {
    await this.db.delete(userSessions).where(eq(userSessions.user_id, userId));
  }

  /**
   * Clean up expired sessions
   * Should be called periodically
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    await this.db
      .delete(userSessions)
      .where(lt(userSessions.expires_at, now));

    // D1 doesn't return rowsAffected, so we return 0
    return 0;
  }
}
