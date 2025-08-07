/**
 * UserSessionService provides user data integration for sessions
 * Handles _User sheet synchronization and user data retrieval
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { SessionManager } from './session-manager';
import { UserSheet, UserRecord } from '../../sheet/user';
import type { 
  Auth0UserData, 
  Auth0FullUserProfile,
  SessionCreateResult
} from '../../types/session';
import type { Env } from '../../types/env';

export class UserSessionService {
  private static initialized = false;

  /**
   * Initialize UserSessionService with database connection
   */
  static initialize(database: DrizzleD1Database): void {
    // Ensure SessionManager is also initialized
    if (!SessionManager.isInitialized()) {
      SessionManager.initialize(database);
    }
    this.initialized = true;
  }

  /**
   * Check if UserSessionService is initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Ensure UserSessionService is initialized
   */
  private static ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('UserSessionService must be initialized before use');
    }
  }

  /**
   * Create a new session for authenticated user and update _User sheet
   */
  static async createSessionWithUserUpdate(
    userData: Auth0UserData, 
    env: Env, 
    fullProfile: Auth0FullUserProfile
  ): Promise<SessionCreateResult> {
    this.ensureInitialized();

    try {
      // Validate user data
      if (!userData.auth0_user_id || !userData.sub) {
        return {
          success: false,
          error: 'Invalid user data: auth0_user_id and sub are required'
        };
      }

      // Update _User sheet with full profile
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

      // Create session using SessionManager
      return await SessionManager.createSession(userData);

    } catch (error) {
      console.error('Session creation with user update error:', error);
      return {
        success: false,
        error: 'Internal error during session creation'
      };
    }
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
  static async getUserData(sessionId: string, env: Env): Promise<UserRecord | null> {
    this.ensureInitialized();

    const sessionValidation = await SessionManager.validateSession(sessionId);
    if (!sessionValidation.valid || !sessionValidation.user_data) {
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
   * Get user data with fallback to environment check
   * Returns null if _User sheet data is not available and environment is not provided
   */
  static async getUserDataWithFallback(sessionId: string, env?: Env): Promise<UserRecord | null> {
    this.ensureInitialized();

    // Environment is required to access _User sheet
    if (!env) {
      return null;
    }

    return await this.getUserData(sessionId, env);
  }

  /**
   * Update user's last login time in _User sheet
   */
  static async updateLastLogin(sessionId: string, env: Env): Promise<boolean> {
    this.ensureInitialized();

    try {
      const sessionValidation = await SessionManager.validateSession(sessionId);
      if (!sessionValidation.valid || !sessionValidation.user_data) {
        return false;
      }

      const userSheet = new UserSheet(env);
      const now = new Date().toISOString();
      
      // Get existing user data first
      const userResult = await userSheet.findById(sessionValidation.user_data.auth0_user_id);
      
      if (userResult.success && userResult.data && Array.isArray(userResult.data) && userResult.data.length > 0) {
        const userData = userResult.data[0];
        
        if (this.isUserRecord(userData)) {
          // Update with existing data plus new last_login
          const updateResult = await userSheet.upsertUser({
            ...userData,
            last_login: now
          });
          
          return updateResult.success;
        }
      }

      return false;
    } catch (error) {
      console.error('Failed to update last login:', error);
      return false;
    }
  }

  /**
   * Sync user profile from Auth0 to _User sheet
   */
  static async syncUserProfile(
    sessionId: string, 
    env: Env, 
    fullProfile: Auth0FullUserProfile
  ): Promise<boolean> {
    this.ensureInitialized();

    try {
      const sessionValidation = await SessionManager.validateSession(sessionId);
      if (!sessionValidation.valid || !sessionValidation.user_data) {
        return false;
      }

      const userSheet = new UserSheet(env);
      const now = new Date().toISOString();
      
      const userSheetResult = await userSheet.upsertUser({
        id: sessionValidation.user_data.auth0_user_id,
        email: fullProfile.email,
        name: fullProfile.name || fullProfile.email,
        picture: fullProfile.picture,
        created_at: now, // Will be ignored if user already exists
        last_login: now
      });

      return userSheetResult.success;
    } catch (error) {
      console.error('Failed to sync user profile:', error);
      return false;
    }
  }
}