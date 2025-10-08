/**
 * Authentication Service
 * Handles user authentication logic
 */

import type { Env } from '../types/env';
import { ConfigRepository } from '../db/config.repository';
import { SessionRepository } from '../db/session.repository';
import { GoogleSheetsService } from './google-sheets.service';
import { verifyPassword } from '../utils/password';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResult {
  success: boolean;
  message: string;
  user?: {
    userId: string;
    username: string;
  };
  sessionId?: string;
  expiresAt?: Date;
}

export class AuthService {
  private configRepo: ConfigRepository;
  private sessionRepo: SessionRepository;

  constructor(env: Env) {
    this.configRepo = new ConfigRepository(env);
    this.sessionRepo = new SessionRepository(env);
  }

  /**
   * Authenticate user and create session
   */
  async login(request: LoginRequest): Promise<LoginResult> {
    const { username, password } = request;

    // Check if setup is completed
    const isSetupComplete = await this.configRepo.isSetupComplete();
    if (!isSetupComplete) {
      return {
        success: false,
        message: 'System setup not completed. Please complete setup first.',
      };
    }

    // Get Google Sheets access token and sheet ID
    const accessToken = await this.configRepo.getGoogleAccessToken();
    const sheetId = await this.configRepo.getSheetId();

    if (!accessToken || !sheetId) {
      return {
        success: false,
        message: 'System not configured',
      };
    }

    const sheetsService = new GoogleSheetsService(accessToken);

    // Get user from _Users sheet (include private columns like _password_hash)
    const usersData = await sheetsService.getSheetData(sheetId, '_Users', {
      includePrivateColumns: true,
    });
    const user = usersData.find((row) => row.username === username);

    if (!user) {
      return {
        success: false,
        message: 'Invalid username or password',
      };
    }

    // Validate password hash exists and is a string
    if (
      !user._password_hash ||
      typeof user._password_hash !== 'string' ||
      user._password_hash.trim() === ''
    ) {
      console.error(
        '[AuthService] Missing or invalid password hash for user:',
        username
      );
      return {
        success: false,
        message: 'Invalid username or password',
      };
    }

    // Verify password
    const isValid = await verifyPassword(password, user._password_hash);

    if (!isValid) {
      return {
        success: false,
        message: 'Invalid username or password',
      };
    }

    // Check user status
    if (user.status !== 'active') {
      return {
        success: false,
        message: 'User account is not active',
      };
    }

    // Get user roles (not needed for session, but useful for response)
    const userId = user.object_id as string;

    // Create session
    const sessionId = crypto.randomUUID();
    const sessionTimeout = await this.configRepo.getSetting('session_timeout');
    const parsedTimeout = sessionTimeout ? Number(sessionTimeout) : NaN;
    const timeoutSeconds = Number.isFinite(parsedTimeout) ? parsedTimeout : 3600; // Default 1 hour
    const expiresAt = new Date(Date.now() + timeoutSeconds * 1000);

    await this.sessionRepo.createSession(sessionId, userId, expiresAt);

    return {
      success: true,
      message: 'Login successful',
      user: {
        userId,
        username,
      },
      sessionId,
      expiresAt,
    };
  }

  /**
   * End user session
   */
  async logout(sessionId: string): Promise<{ success: boolean; message: string }> {
    await this.sessionRepo.deleteSession(sessionId);
    return {
      success: true,
      message: 'Logout successful',
    };
  }
}
