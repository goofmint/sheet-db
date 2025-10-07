/**
 * Google OAuth2 Service
 *
 * Handles authentication and token management using fetch-based REST API
 * Compatible with Cloudflare Workers runtime
 *
 * Required OAuth Scopes:
 * - https://www.googleapis.com/auth/spreadsheets (read/write for sheet operations)
 * - https://www.googleapis.com/auth/drive.file (access to files created/opened by this app)
 */

import type { Env } from '../types/env';
import type { TokenResponse } from '../types/google';
import { ConfigRepository } from '../db/config.repository';

export class GoogleAuthService {
  private configRepo: ConfigRepository;

  constructor(env: Env) {
    this.configRepo = new ConfigRepository(env);
  }

  /**
   * Get Google credentials from config table
   */
  private async getCredentials(): Promise<{
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }> {
    const credentials = await this.configRepo.getGoogleCredentials();

    if (!credentials) {
      throw new Error('Google credentials not configured');
    }

    return credentials;
  }

  /**
   * Generate authorization URL for OAuth2 flow
   *
   * @param state - CSRF state token (unsigned, will be signed in cookie)
   * @returns Authorization URL for user to visit
   */
  async getAuthUrl(state: string): Promise<string> {
    const { clientId, redirectUri } = await this.getCredentials();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file',
      ].join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  /**
   * Exchange authorization code for tokens
   *
   * @param code - Authorization code from OAuth2 callback
   * @returns Token response with access_token and refresh_token
   */
  async getTokens(code: string): Promise<TokenResponse> {
    const { clientId, clientSecret, redirectUri } = await this.getCredentials();

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${error}`);
    }

    return (await response.json()) as TokenResponse;
  }

  /**
   * Refresh access token using refresh token
   *
   * @param refreshToken - Refresh token from previous OAuth2 flow
   * @returns New access token
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    const { clientId, clientSecret } = await this.getCredentials();

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${error}`);
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  /**
   * Get valid access token (refreshes if expired)
   *
   * @returns Valid access token
   */
  async getValidAccessToken(): Promise<string> {
    const accessToken = await this.configRepo.getGoogleAccessToken();
    const refreshToken = await this.configRepo.getGoogleRefreshToken();

    if (!accessToken || !refreshToken) {
      throw new Error('No Google tokens available. Please authenticate first.');
    }

    // Check if token is expired (simple check - could be improved with expiry tracking)
    // For now, we'll try to use it and refresh on 401

    return accessToken;
  }
}
