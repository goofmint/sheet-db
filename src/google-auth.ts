import { drizzle } from 'drizzle-orm/d1';
import { eq, inArray } from 'drizzle-orm';
import { configTable } from './db/schema';

// Database type for Drizzle with D1
export type DatabaseConnection = ReturnType<typeof drizzle<Record<string, never>, D1Database>>;

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  expires_at?: number;
}

export interface GoogleCredentials {
  client_id: string;
  client_secret: string;
}

// Keys used in Config table
export const CONFIG_KEYS = {
  GOOGLE_CLIENT_ID: 'google_client_id',
  GOOGLE_CLIENT_SECRET: 'google_client_secret',
  GOOGLE_ACCESS_TOKEN: 'google_access_token',
  GOOGLE_REFRESH_TOKEN: 'google_refresh_token',
  GOOGLE_TOKEN_EXPIRES_AT: 'google_token_expires_at',
  GOOGLE_TOKEN_SCOPE: 'google_token_scope',
  SETUP_COMPLETED: 'setup_completed',
  SESSION_EXPIRED_SECONDS: 'session_expired_seconds',
} as const;

/**
 * Get configuration value from Config table
 * @param db Database instance
 * @param key Single key or array of keys to retrieve
 * @returns Single value for string key, or Record<string, string | null> for array keys
 */
export async function getConfig(db: DatabaseConnection, key: string): Promise<string | null>;
export async function getConfig(db: DatabaseConnection, keys: string[]): Promise<Record<string, string | null>>;
export async function getConfig(db: DatabaseConnection, keyOrKeys: string | string[]): Promise<string | null | Record<string, string | null>> {
  if (typeof keyOrKeys === 'string') {
    // Single key
    const result = await db.select().from(configTable).where(eq(configTable.name, keyOrKeys));
    return result.length > 0 ? result[0].value : null;
  } else {
    // Multiple keys
    const keys = keyOrKeys;
    const result = await db.select().from(configTable).where(inArray(configTable.name, keys));
    
    // Create result object with all requested keys, defaulting to null
    const configMap: Record<string, string | null> = {};
    keys.forEach(key => {
      configMap[key] = null;
    });
    
    // Fill in the actual values
    result.forEach(row => {
      configMap[row.name] = row.value;
    });
    
    return configMap;
  }
}

/**
 * Save configuration value to Config table
 */
export async function setConfig(db: DatabaseConnection, key: string, value: string): Promise<void> {
  const existing = await db.select().from(configTable).where(eq(configTable.name, key));
  
  if (existing.length > 0) {
    await db.update(configTable)
      .set({ value })
      .where(eq(configTable.name, key));
  } else {
    await db.insert(configTable).values({ name: key, value });
  }
}

/**
 * Save Google OAuth credentials
 */
export async function saveGoogleCredentials(db: DatabaseConnection, credentials: GoogleCredentials): Promise<void> {
  await setConfig(db, CONFIG_KEYS.GOOGLE_CLIENT_ID, credentials.client_id);
  await setConfig(db, CONFIG_KEYS.GOOGLE_CLIENT_SECRET, credentials.client_secret);
}

/**
 * Get Google OAuth credentials
 */
export async function getGoogleCredentials(db: DatabaseConnection): Promise<GoogleCredentials | null> {
  const configs = await getConfig(db, [CONFIG_KEYS.GOOGLE_CLIENT_ID, CONFIG_KEYS.GOOGLE_CLIENT_SECRET]);
  
  const clientId = configs[CONFIG_KEYS.GOOGLE_CLIENT_ID];
  const clientSecret = configs[CONFIG_KEYS.GOOGLE_CLIENT_SECRET];
  
  if (!clientId || !clientSecret) {
    return null;
  }
  
  return {
    client_id: clientId,
    client_secret: clientSecret,
  };
}

/**
 * Save Google access tokens
 */
export async function saveGoogleTokens(db: DatabaseConnection, tokens: GoogleTokens): Promise<void> {
  const expiresAt = Date.now() + (tokens.expires_in * 1000);
  
  console.log('Saving Google tokens:', {
    hasAccessToken: !!tokens.access_token,
    hasRefreshToken: !!tokens.refresh_token,
    expiresIn: tokens.expires_in,
    expiresAt: new Date(expiresAt).toISOString(),
    scope: tokens.scope
  });
  
  await setConfig(db, CONFIG_KEYS.GOOGLE_ACCESS_TOKEN, tokens.access_token);
  await setConfig(db, CONFIG_KEYS.GOOGLE_TOKEN_EXPIRES_AT, expiresAt.toString());
  await setConfig(db, CONFIG_KEYS.GOOGLE_TOKEN_SCOPE, tokens.scope);
  
  if (tokens.refresh_token) {
    await setConfig(db, CONFIG_KEYS.GOOGLE_REFRESH_TOKEN, tokens.refresh_token);
    console.log('Refresh token saved');
  } else {
    console.log('No refresh token to save');
  }
}

/**
 * Get saved Google access tokens
 */
export async function getGoogleTokens(db: DatabaseConnection): Promise<GoogleTokens | null> {
  const configs = await getConfig(db, [
    CONFIG_KEYS.GOOGLE_ACCESS_TOKEN,
    CONFIG_KEYS.GOOGLE_REFRESH_TOKEN,
    CONFIG_KEYS.GOOGLE_TOKEN_EXPIRES_AT,
    CONFIG_KEYS.GOOGLE_TOKEN_SCOPE
  ]);
  
  const accessToken = configs[CONFIG_KEYS.GOOGLE_ACCESS_TOKEN];
  const refreshToken = configs[CONFIG_KEYS.GOOGLE_REFRESH_TOKEN];
  const expiresAt = configs[CONFIG_KEYS.GOOGLE_TOKEN_EXPIRES_AT];
  const scope = configs[CONFIG_KEYS.GOOGLE_TOKEN_SCOPE];
  
  if (!accessToken || !expiresAt) {
    return null;
  }
  
  return {
    access_token: accessToken,
    refresh_token: refreshToken || undefined,
    expires_in: Math.max(0, Math.floor((parseInt(expiresAt) - Date.now()) / 1000)),
    expires_at: parseInt(expiresAt),
    scope: scope || '',
    token_type: 'Bearer',
  };
}

/**
 * Check if access token is valid
 */
export async function isTokenValid(db: DatabaseConnection): Promise<boolean> {
  const tokens = await getGoogleTokens(db);
  if (!tokens || !tokens.expires_at) {
    console.log('No tokens or expires_at found');
    return false;
  }
  
  const now = Date.now();
  const expiresAt = tokens.expires_at;
  const marginTime = now + 300000; // 5 minute margin
  
  console.log('Token validation:', {
    now: new Date(now).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    marginTime: new Date(marginTime).toISOString(),
    isValid: expiresAt > marginTime,
    hasRefreshToken: !!tokens.refresh_token
  });
  
  // Add 5 minute margin
  return expiresAt > marginTime;
}

/**
 * Get access token using authentication code
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  credentials: GoogleCredentials
): Promise<GoogleTokens> {
  const tokenEndpoint = 'https://oauth2.googleapis.com/token';
  
  const params = new URLSearchParams({
    client_id: credentials.client_id,
    client_secret: credentials.client_secret,
    code: code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }
  
  return await response.json() as GoogleTokens;
}

/**
 * Update access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string,
  credentials: GoogleCredentials
): Promise<GoogleTokens> {
  const tokenEndpoint = 'https://oauth2.googleapis.com/token';
  
  const params = new URLSearchParams({
    client_id: credentials.client_id,
    client_secret: credentials.client_secret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
  }
  
  const tokens = await response.json() as GoogleTokens;
  
  // When refreshing, a new refresh_token may not be returned, so
  // keep the original refresh_token
  if (!tokens.refresh_token) {
    tokens.refresh_token = refreshToken;
  }
  
  return tokens;
}

/**
 * Check if setup is completed
 */
export async function isSetupCompleted(db: DatabaseConnection): Promise<boolean> {
  const completed = await getConfig(db, CONFIG_KEYS.SETUP_COMPLETED);
  return completed === 'true';
}

/**
 * Reset setup completion flag
 */
export async function resetSetupCompleted(db: DatabaseConnection): Promise<void> {
  await setConfig(db, CONFIG_KEYS.SETUP_COMPLETED, 'false');
}