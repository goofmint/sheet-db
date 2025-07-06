import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { configTable } from './db/schema';

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

// Configテーブルで使用するキー
export const CONFIG_KEYS = {
  GOOGLE_CLIENT_ID: 'google_client_id',
  GOOGLE_CLIENT_SECRET: 'google_client_secret',
  GOOGLE_ACCESS_TOKEN: 'google_access_token',
  GOOGLE_REFRESH_TOKEN: 'google_refresh_token',
  GOOGLE_TOKEN_EXPIRES_AT: 'google_token_expires_at',
  GOOGLE_TOKEN_SCOPE: 'google_token_scope',
  SETUP_COMPLETED: 'setup_completed',
} as const;

/**
 * Configテーブルから設定値を取得
 */
export async function getConfig(db: any, key: string): Promise<string | null> {
  const result = await db.select().from(configTable).where(eq(configTable.name, key));
  return result.length > 0 ? result[0].value : null;
}

/**
 * Configテーブルに設定値を保存
 */
export async function setConfig(db: any, key: string, value: string): Promise<void> {
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
 * Google OAuth認証情報を保存
 */
export async function saveGoogleCredentials(db: any, credentials: GoogleCredentials): Promise<void> {
  await setConfig(db, CONFIG_KEYS.GOOGLE_CLIENT_ID, credentials.client_id);
  await setConfig(db, CONFIG_KEYS.GOOGLE_CLIENT_SECRET, credentials.client_secret);
}

/**
 * Google OAuth認証情報を取得
 */
export async function getGoogleCredentials(db: any): Promise<GoogleCredentials | null> {
  const clientId = await getConfig(db, CONFIG_KEYS.GOOGLE_CLIENT_ID);
  const clientSecret = await getConfig(db, CONFIG_KEYS.GOOGLE_CLIENT_SECRET);
  
  if (!clientId || !clientSecret) {
    return null;
  }
  
  return {
    client_id: clientId,
    client_secret: clientSecret,
  };
}

/**
 * Googleアクセストークンを保存
 */
export async function saveGoogleTokens(db: any, tokens: GoogleTokens): Promise<void> {
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
 * 保存されたGoogleアクセストークンを取得
 */
export async function getGoogleTokens(db: any): Promise<GoogleTokens | null> {
  const accessToken = await getConfig(db, CONFIG_KEYS.GOOGLE_ACCESS_TOKEN);
  const refreshToken = await getConfig(db, CONFIG_KEYS.GOOGLE_REFRESH_TOKEN);
  const expiresAt = await getConfig(db, CONFIG_KEYS.GOOGLE_TOKEN_EXPIRES_AT);
  const scope = await getConfig(db, CONFIG_KEYS.GOOGLE_TOKEN_SCOPE);
  
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
 * アクセストークンが有効かチェック
 */
export async function isTokenValid(db: any): Promise<boolean> {
  const tokens = await getGoogleTokens(db);
  if (!tokens || !tokens.expires_at) {
    console.log('No tokens or expires_at found');
    return false;
  }
  
  const now = Date.now();
  const expiresAt = tokens.expires_at;
  const marginTime = now + 300000; // 5分のマージン
  
  console.log('Token validation:', {
    now: new Date(now).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    marginTime: new Date(marginTime).toISOString(),
    isValid: expiresAt > marginTime,
    hasRefreshToken: !!tokens.refresh_token
  });
  
  // 5分のマージンを持たせる
  return expiresAt > marginTime;
}

/**
 * 認証コードを使ってアクセストークンを取得
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
 * リフレッシュトークンを使ってアクセストークンを更新
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
  
  // リフレッシュ時は新しいrefresh_tokenが返されない場合があるので、
  // 元のrefresh_tokenを保持
  if (!tokens.refresh_token) {
    tokens.refresh_token = refreshToken;
  }
  
  return tokens;
}

/**
 * セットアップが完了しているかをチェック
 */
export async function isSetupCompleted(db: any): Promise<boolean> {
  const completed = await getConfig(db, CONFIG_KEYS.SETUP_COMPLETED);
  return completed === 'true';
}

/**
 * セットアップ完了フラグをリセット
 */
export async function resetSetupCompleted(db: any): Promise<void> {
  await setConfig(db, CONFIG_KEYS.SETUP_COMPLETED, 'false');
}