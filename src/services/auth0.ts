import { Env } from '../types/env';
import { ConfigService } from './config';
import { drizzle } from 'drizzle-orm/d1';
import { 
  Auth0Config, 
  Auth0TokenResponse, 
  TokenExchangeRequest,
  RefreshTokenRequest,
  Auth0ErrorResponse,
  JWTPayload,
  JWKS,
  JWK
} from '../types/auth';
import { Auth0Profile, AuthToken } from '../types/session.d';

export class Auth0Service {
  private jwksCache: Map<string, JWK> = new Map();
  private jwksCacheExpiry: number = 0;

  constructor(private env: Env) {}

  /**
   * Get Auth0 configuration from Config table
   */
  private async getConfig(): Promise<Auth0Config> {
    // Ensure ConfigService is initialized
    const db = drizzle(this.env.DB);
    if (!ConfigService.isInitialized()) {
      await ConfigService.initialize(db);
    }
    
    const auth0Domain = ConfigService.getString('auth0.domain');
    const auth0ClientId = ConfigService.getString('auth0.client_id');
    const auth0ClientSecret = ConfigService.getString('auth0.client_secret');
    
    if (!auth0Domain || !auth0ClientId || !auth0ClientSecret) {
      throw new Error('Auth0 configuration not found');
    }

    const auth0Audience = ConfigService.getString('auth0.audience');
    const auth0Scope = ConfigService.getString('auth0.scope');

    return {
      domain: auth0Domain,
      clientId: auth0ClientId,
      clientSecret: auth0ClientSecret,
      audience: auth0Audience || undefined,
      scope: auth0Scope || 'openid profile email'
    };
  }

  /**
   * Generate authorization URL for Auth0 login
   */
  async getAuthorizationUrl(state: string, redirectUri: string): Promise<string> {
    const config = await this.getConfig();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: config.scope,
      state: state,
      ...(config.audience && { audience: config.audience })
    });

    return `https://${config.domain}/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<AuthToken> {
    const config = await this.getConfig();
    
    const body: TokenExchangeRequest = {
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: code,
      redirect_uri: redirectUri
    };

    const response = await fetch(`https://${config.domain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json() as Auth0ErrorResponse;
      throw new Error(`Auth0 token exchange failed: ${error.error} - ${error.error_description || ''}`);
    }

    const tokenResponse = await response.json() as Auth0TokenResponse;

    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresIn: tokenResponse.expires_in,
      tokenType: 'Bearer',
      scope: tokenResponse.scope
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthToken> {
    const config = await this.getConfig();
    
    const body: RefreshTokenRequest = {
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken
    };

    const response = await fetch(`https://${config.domain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json() as Auth0ErrorResponse;
      throw new Error(`Auth0 token refresh failed: ${error.error} - ${error.error_description || ''}`);
    }

    const tokenResponse = await response.json() as Auth0TokenResponse;

    return {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresIn: tokenResponse.expires_in,
      tokenType: 'Bearer',
      scope: tokenResponse.scope
    };
  }

  /**
   * Get user info from Auth0
   */
  async getUserInfo(accessToken: string): Promise<Auth0Profile> {
    const config = await this.getConfig();
    
    const response = await fetch(`https://${config.domain}/userinfo`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get user info: ${response.status}`);
    }

    return await response.json() as Auth0Profile;
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token: string): Promise<JWTPayload> {
    const [header, payload, signature] = token.split('.');
    
    if (!header || !payload || !signature) {
      throw new Error('Invalid token format');
    }

    // Decode header to get kid
    const decodedHeader = JSON.parse(atob(header));
    const kid = decodedHeader.kid;

    if (!kid) {
      throw new Error('Token missing kid');
    }

    // Decode and validate payload first (before expensive operations)
    const decodedPayload = JSON.parse(atob(payload)) as JWTPayload;
    
    // Validate expiration first
    if (decodedPayload.exp * 1000 < Date.now()) {
      throw new Error('Token expired');
    }

    // Validate issuer
    const config = await this.getConfig();
    if (decodedPayload.iss !== `https://${config.domain}/`) {
      throw new Error('Invalid token issuer');
    }

    // Validate audience if configured
    if (config.audience) {
      const aud = Array.isArray(decodedPayload.aud) ? decodedPayload.aud : [decodedPayload.aud];
      if (!aud.includes(config.audience)) {
        throw new Error('Invalid token audience');
      }
    }

    // Get signing key
    const key = await this.getSigningKey(kid);
    
    // Import the key
    const publicKey = await this.importKey(key);
    
    // Verify signature
    const encoder = new TextEncoder();
    const data = encoder.encode(`${header}.${payload}`);
    const sig = this.base64UrlToArrayBuffer(signature);
    
    const valid = await crypto.subtle.verify(
      'RS256',
      publicKey,
      sig,
      data
    );

    if (!valid) {
      throw new Error('Invalid token signature');
    }

    return decodedPayload;
  }

  /**
   * Get signing key from JWKS endpoint
   */
  private async getSigningKey(kid: string): Promise<JWK> {
    // Check cache first
    if (this.jwksCacheExpiry > Date.now()) {
      const cachedKey = this.jwksCache.get(kid);
      if (cachedKey) {
        return cachedKey;
      }
    }

    // Fetch JWKS
    const config = await this.getConfig();
    const response = await fetch(`https://${config.domain}/.well-known/jwks.json`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch JWKS');
    }

    const jwks = await response.json() as JWKS;
    
    // Cache all keys
    this.jwksCache.clear();
    for (const key of jwks.keys) {
      this.jwksCache.set(key.kid, key);
    }
    this.jwksCacheExpiry = Date.now() + 3600000; // Cache for 1 hour

    const key = this.jwksCache.get(kid);
    if (!key) {
      throw new Error('Signing key not found');
    }

    return key;
  }

  /**
   * Import JWK as CryptoKey
   */
  private async importKey(jwk: JWK): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      'jwk',
      {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e,
        alg: jwk.alg,
        use: jwk.use
      },
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      },
      false,
      ['verify']
    );
  }

  /**
   * Convert base64url to ArrayBuffer
   */
  private base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - base64.length % 4) % 4);
    const binary = atob(base64 + padding);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return buffer;
  }
}