import { eq, lt, desc } from 'drizzle-orm';
import { AbstractBaseRepository } from './base';
import { 
  sessionTable, 
  type Session, 
  type SessionInsert, 
  type SessionUpdate 
} from '../db/schema';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

/**
 * Session Repository for managing user sessions
 */
export class SessionRepository extends AbstractBaseRepository<Session, SessionInsert, SessionUpdate> {
  
  constructor(database: DrizzleD1Database) {
    super(database);
  }

  /**
   * Find session by ID
   */
  async findById(id: number): Promise<Session | null> {
    const result = await this.db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.id, id))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Find all sessions with optional pagination
   */
  async findAll(limit = 100, offset = 0): Promise<Session[]> {
    return await this.db
      .select()
      .from(sessionTable)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Create new session
   */
  async create(data: SessionInsert): Promise<Session> {
    const result = await this.db
      .insert(sessionTable)
      .values(data)
      .returning();
    
    return result[0];
  }

  /**
   * Update session by ID
   */
  async update(id: number, data: SessionUpdate): Promise<Session | null> {
    const result = await this.db
      .update(sessionTable)
      .set(data)
      .where(eq(sessionTable.id, id))
      .returning();
    
    return result[0] || null;
  }

  /**
   * Delete session by ID
   */
  async delete(id: number): Promise<boolean> {
    const result = await this.db
      .delete(sessionTable)
      .where(eq(sessionTable.id, id))
      .returning();
    
    return result.length > 0;
  }

  /**
   * Find session by session ID
   */
  async findBySessionId(sessionId: string): Promise<Session | null> {
    const result = await this.db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.session_id, sessionId))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Find valid (non-expired) session by session ID
   */
  async findValidBySessionId(sessionId: string): Promise<Session | null> {
    const now = new Date().toISOString();
    const result = await this.db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.session_id, sessionId))
      .limit(1);
    
    const session = result[0];
    if (!session) return null;
    
    // Check if session is expired
    if (session.expires_at < now) {
      // Cleanup expired session
      await this.deleteBySessionId(sessionId);
      return null;
    }
    
    return session;
  }

  /**
   * Find all sessions for a user
   */
  async findByUserId(userId: string): Promise<Session[]> {
    return await this.db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.user_id, userId));
  }

  /**
   * Delete session by session ID
   */
  async deleteBySessionId(sessionId: string): Promise<boolean> {
    const result = await this.db
      .delete(sessionTable)
      .where(eq(sessionTable.session_id, sessionId))
      .returning();
    
    return result.length > 0;
  }

  /**
   * Delete all expired sessions
   */
  async deleteExpired(): Promise<number> {
    const now = new Date().toISOString();
    const result = await this.db
      .delete(sessionTable)
      .where(lt(sessionTable.expires_at, now))
      .returning();
    
    return result.length;
  }

  /**
   * Create a new session with generated session ID
   */
  async createSession(userId: string, userData: object, expiresAt: Date): Promise<Session> {
    const sessionId = this.generateSessionId();
    
    const sessionData: SessionInsert = {
      session_id: sessionId,
      user_id: userId,
      user_data: JSON.stringify(userData),
      expires_at: expiresAt.toISOString()
    };

    return await this.create(sessionData);
  }

  /**
   * Update tokens for a session
   */
  async updateTokens(sessionId: string, accessToken?: string, refreshToken?: string): Promise<Session | null> {
    const updateData: SessionUpdate = {};
    
    if (accessToken !== undefined) updateData.access_token = accessToken;
    if (refreshToken !== undefined) updateData.refresh_token = refreshToken;
    
    if (Object.keys(updateData).length === 0) {
      // No tokens to update
      return await this.findBySessionId(sessionId);
    }

    const result = await this.db
      .update(sessionTable)
      .set(updateData)
      .where(eq(sessionTable.session_id, sessionId))
      .returning();
    
    return result[0] || null;
  }

  /**
   * Extend session expiry time
   */
  async extendExpiry(sessionId: string, newExpiresAt: Date): Promise<Session | null> {
    const result = await this.db
      .update(sessionTable)
      .set({ expires_at: newExpiresAt.toISOString() })
      .where(eq(sessionTable.session_id, sessionId))
      .returning();
    
    return result[0] || null;
  }

  /**
   * Get parsed user data from session
   */
  async getUserData<T = object>(sessionId: string): Promise<T | null> {
    const session = await this.findValidBySessionId(sessionId);
    if (!session) return null;
    
    try {
      return JSON.parse(session.user_data) as T;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up sessions for a user (keep only the N most recent)
   */
  async cleanupUserSessions(userId: string, keepCount: number): Promise<number> {
    const sessions = await this.db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.user_id, userId))
      .orderBy(desc(sessionTable.created_at));

    if (sessions.length <= keepCount) {
      return 0;
    }

    const sessionsToDelete = sessions.slice(keepCount);
    let deletedCount = 0;

    for (const session of sessionsToDelete) {
      const deleted = await this.delete(session.id);
      if (deleted) deletedCount++;
    }

    return deletedCount;
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2);
    return `sess_${timestamp}_${randomPart}`;
  }
}