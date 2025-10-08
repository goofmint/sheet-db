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
   * Create a new session
   */
  async createSession(
    sessionId: string,
    userId: string,
    expiresAt: Date
  ): Promise<void> {
    await this.db.insert(userSessions).values({
      token_hash: sessionId,
      user_id: userId,
      expires_at: expiresAt,
    });
  }

  /**
   * Get session by session ID
   * Returns null if session doesn't exist or has expired
   */
  async getSession(sessionId: string): Promise<{ userId: string } | null> {
    const result = await this.db
      .select()
      .from(userSessions)
      .where(eq(userSessions.token_hash, sessionId))
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
    await this.db
      .delete(userSessions)
      .where(eq(userSessions.token_hash, sessionId));
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
