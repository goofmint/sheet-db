/**
 * SessionService provides session management functionality
 * Handles session creation, validation, refresh, and cleanup
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { SessionRepository } from '../repositories/session';
import { ConfigService } from './config';
import { constantTimeEquals } from '../utils/security';
import { UserSheet, UserRecord } from '../sheet/user';
import type { 
  Auth0UserData, 
  Auth0FullUserProfile,
  SessionCreateResult, 
  SessionValidationResult, 
  SessionRefreshResult 
} from '../types/session';
import type { Session } from '../db/schema';
import type { Env } from '../types/env';

export class SessionService {
  private static repository: SessionRepository;
  private static initialized = false;

  /**
   * Initialize SessionService with database connection
   */
  static initialize(database: DrizzleD1Database): void {
    this.repository = new SessionRepository(database);
    this.initialized = true;
  }

  /**
   * Check if SessionService is initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Ensure SessionService is initialized
   */
  private static ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('SessionService must be initialized before use');
    }
  }

  /**
   * Create a new session for authenticated user and update _User sheet
   */
  static async createSession(userData: Auth0UserData, env?: Env, fullProfile?: Auth0FullUserProfile): Promise<SessionCreateResult> {
    this.ensureInitialized();

    try {
      // Validate user data
      if (!userData.auth0_user_id || !userData.sub) {
        return {
          success: false,
          error: 'Invalid user data: auth0_user_id and sub are required'
        };
      }

      // Get session max age from config (default 30 days)
      const sessionMaxAge = ConfigService.getNumber('session_max_age', 2592000); // 30 days in seconds
      const expiresAt = new Date(Date.now() + sessionMaxAge * 1000);

      // Generate session ID
      const sessionId = crypto.randomUUID();

      // Prepare minimal user data for storage (no PII)
      const minimalUserData = {
        auth0_user_id: userData.auth0_user_id,
        sub: userData.sub
      };

      // Update _User sheet if environment and full profile are provided
      if (env && fullProfile) {
        const userSheet = new UserSheet(env);
        const now = new Date().toISOString();
        
        const userSheetResult = await userSheet.upsertUser({
          id: userData.auth0_user_id,
          email: fullProfile.email,
          name: fullProfile.name || fullProfile.email,
          picture: fullProfile.picture,
          created_at: now, // Will be ignored if user already exists
          last_login: now
        });

        if (!userSheetResult.success) {
          console.error('Failed to update _User sheet:', userSheetResult.error);
          return {
            success: false,
            error: 'Failed to update user data in _User sheet'
          };
        }
      }

      // Create session in database using direct create method
      const sessionData = {
        session_id: sessionId,
        user_id: userData.auth0_user_id,
        user_data: JSON.stringify(minimalUserData),
        expires_at: expiresAt.toISOString()
      };

      const session = await this.repository.create(sessionData);

      if (!session) {
        return {
          success: false,
          error: 'Failed to create session in database'
        };
      }

      return {
        success: true,
        session_id: session.session_id,
        expires_at: session.expires_at
      };

    } catch (error) {
      console.error('Session creation error:', error);
      return {
        success: false,
        error: 'Internal error during session creation'
      };
    }
  }

  /**
   * Validate session and return user data
   */
  static async validateSession(sessionId: string): Promise<SessionValidationResult> {
    this.ensureInitialized();

    try {
      // Basic session ID validation
      if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
        return {
          valid: false,
          error: 'Invalid session ID'
        };
      }

      // Find valid session
      const session = await this.repository.findValidBySessionId(sessionId);
      
      if (!session) {
        return {
          valid: false,
          error: 'Session not found or expired'
        };
      }

      // Parse user data (new format only)
      let userData: Auth0UserData;
      try {
        const parsedData = JSON.parse(session.user_data);
        
        // Validate new minimal format
        if (!parsedData.auth0_user_id || !parsedData.sub) {
          throw new Error('Invalid user data structure: missing required identifiers');
        }

        userData = {
          auth0_user_id: parsedData.auth0_user_id,
          sub: parsedData.sub
        };
      } catch (parseError) {
        console.error('Failed to parse session user data:', parseError);
        return {
          valid: false,
          error: 'Invalid session data'
        };
      }

      return {
        valid: true,
        user_data: userData,
        session_id: session.session_id,
        expires_at: session.expires_at
      };

    } catch (error) {
      console.error('Session validation error:', error);
      return {
        valid: false,
        error: 'Internal error during session validation'
      };
    }
  }

  /**
   * Refresh session expiry time
   */
  static async refreshSession(sessionId: string): Promise<SessionRefreshResult> {
    this.ensureInitialized();

    try {
      // Validate session ID
      if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
        return {
          success: false,
          error: 'Invalid session ID'
        };
      }

      // Check if session exists and is valid
      const existingSession = await this.repository.findValidBySessionId(sessionId);
      if (!existingSession) {
        return {
          success: false,
          error: 'Session not found or expired'
        };
      }

      // Calculate new expiry time
      const sessionMaxAge = ConfigService.getNumber('session_max_age', 2592000); // 30 days in seconds
      const newExpiresAt = new Date(Date.now() + sessionMaxAge * 1000);

      // Update session expiry
      const updatedSession = await this.repository.extendExpiry(sessionId, newExpiresAt);
      
      if (!updatedSession) {
        return {
          success: false,
          error: 'Failed to refresh session'
        };
      }

      return {
        success: true,
        new_expires_at: updatedSession.expires_at
      };

    } catch (error) {
      console.error('Session refresh error:', error);
      return {
        success: false,
        error: 'Internal error during session refresh'
      };
    }
  }

  /**
   * Delete session
   */
  static async deleteSession(sessionId: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      // Validate session ID
      if (!sessionId || typeof sessionId !== 'string' || sessionId.trim() === '') {
        return false;
      }

      // Delete session from database
      return await this.repository.deleteBySessionId(sessionId);

    } catch (error) {
      console.error('Session deletion error:', error);
      return false;
    }
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions(): Promise<number> {
    this.ensureInitialized();

    try {
      return await this.repository.deleteExpired();
    } catch (error) {
      console.error('Session cleanup error:', error);
      return 0;
    }
  }

  /**
   * Validate session ID using constant-time comparison
   * This is a utility method for secure session validation
   */
  static validateSessionId(providedId: string, storedId: string): boolean {
    if (!providedId || !storedId) {
      return false;
    }
    return constantTimeEquals(providedId, storedId);
  }

  /**
   * Type guard to check if a SheetRow is a valid UserRecord
   */
  private static isUserRecord(data: unknown): data is UserRecord {
    if (data === null || data === undefined || typeof data !== 'object') {
      return false;
    }

    const obj = data as Record<string, unknown>;
    
    // Check required fields
    if (typeof obj.id !== 'string' ||
        typeof obj.email !== 'string' ||
        typeof obj.name !== 'string' ||
        typeof obj.created_at !== 'string') {
      return false;
    }

    // Check optional fields
    const pictureValid = obj.picture === undefined || 
                        obj.picture === null || 
                        typeof obj.picture === 'string';
    
    const lastLoginValid = obj.last_login === undefined || 
                          obj.last_login === null || 
                          typeof obj.last_login === 'string';

    return pictureValid && lastLoginValid;
  }

  /**
   * Get user data from _User sheet based on session
   * Returns null if _User sheet data is not available
   */
  static async getUserData(sessionId: string, env?: Env): Promise<UserRecord | null> {
    const sessionValidation = await this.validateSession(sessionId);
    if (!sessionValidation.valid || !sessionValidation.user_data) {
      return null;
    }

    // Environment is required to access _User sheet
    if (!env) {
      return null;
    }

    try {
      const userSheet = new UserSheet(env);
      const userResult = await userSheet.findById(sessionValidation.user_data.auth0_user_id);
      
      if (userResult.success && userResult.data && Array.isArray(userResult.data) && userResult.data.length > 0) {
        const userData = userResult.data[0];
        if (this.isUserRecord(userData)) {
          return userData; // Return full user data from _User sheet
        } else {
          console.warn('Invalid user data structure from _User sheet:', userData);
        }
      }
    } catch (error) {
      console.error('Failed to get user data from _User sheet:', error);
    }

    // Return null if _User sheet data is not available
    return null;
  }

  /**
   * Get authentication data only (minimal identifiers from session)
   */
  static async getAuthData(sessionId: string): Promise<Auth0UserData | null> {
    const result = await this.validateSession(sessionId);
    return result.valid ? result.user_data || null : null;
  }


  /**
   * Check if session exists and is valid (convenience method)
   */
  static async isValidSession(sessionId: string): Promise<boolean> {
    const result = await this.validateSession(sessionId);
    return result.valid;
  }

  /**
   * Cleanup sessions for a specific user (keep only N most recent)
   */
  static async cleanupUserSessions(userId: string, keepCount: number = 5): Promise<number> {
    this.ensureInitialized();

    try {
      return await this.repository.cleanupUserSessions(userId, keepCount);
    } catch (error) {
      console.error('User session cleanup error:', error);
      return 0;
    }
  }
}