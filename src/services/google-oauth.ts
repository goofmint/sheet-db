import { ConfigService } from './config';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
}

/**
 * GoogleのOAuth2トークン管理サービス
 */
export class GoogleOAuthService {

  /**
   * 有効なアクセストークンを取得（必要に応じてリフレッシュ）
   */
  async getValidAccessToken(): Promise<string> {

    const accessToken = ConfigService.getString('google.access_token');
    const tokenExpiry = ConfigService.getString('google.token_expiry');
    
    console.log('Checking Google token validity...', {
      hasAccessToken: !!accessToken,
      tokenExpiry,
      currentTime: new Date().toISOString()
    });
    
    // トークンが存在しない場合
    if (!accessToken) {
      throw new Error('Google access token not found. Please re-authenticate.');
    }

    // まずはトークン有効性をGoogleに直接確認
    const isTokenValid = await this.validateToken(accessToken);
    console.log('Token validation result:', isTokenValid);

    if (!isTokenValid) {
      console.log('Google access token is invalid, refreshing...');
      return await this.refreshAccessToken();
    }

    // 有効期限をチェック（5分のマージンを設ける）
    const now = new Date();
    const expiry = tokenExpiry ? new Date(tokenExpiry) : new Date(0);
    const marginMs = 5 * 60 * 1000; // 5分

    console.log('Token expiry check:', {
      expiryTime: expiry.toISOString(),
      currentTime: now.toISOString(),
      timeUntilExpiry: expiry.getTime() - now.getTime(),
      marginMs,
      needsRefresh: expiry.getTime() - now.getTime() <= marginMs
    });

    if (expiry.getTime() - now.getTime() <= marginMs) {
      // トークンが期限切れまたは期限切れ間近の場合、リフレッシュする
      console.log('Google access token expired or expiring soon, refreshing...');
      return await this.refreshAccessToken();
    }

    // トークンはまだ有効
    console.log('Token is still valid, using existing token');
    return accessToken;
  }

  /**
   * リフレッシュトークンを使用してアクセストークンを更新
   */
  async refreshAccessToken(): Promise<string> {

    const refreshToken = ConfigService.getString('google.refresh_token');
    const clientId = ConfigService.getString('google.client_id');
    const clientSecret = ConfigService.getString('google.client_secret');

    if (!refreshToken || !clientId || !clientSecret) {
      throw new Error('Missing Google OAuth credentials for token refresh');
    }

    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
      }

      const tokenData = await response.json() as GoogleTokenResponse;

      // 新しいアクセストークンと有効期限を保存
      const expiryDate = new Date(Date.now() + tokenData.expires_in * 1000);
      
      await ConfigService.upsert('google.access_token', tokenData.access_token, 'string');
      await ConfigService.upsert('google.token_expiry', expiryDate.toISOString(), 'string');

      // 新しいリフレッシュトークンが提供された場合は更新
      if (tokenData.refresh_token) {
        await ConfigService.upsert('google.refresh_token', tokenData.refresh_token, 'string');
      }

      console.log('Google access token refreshed successfully', {
        newTokenLength: tokenData.access_token.length,
        expiresIn: tokenData.expires_in,
        expiryDate: expiryDate.toISOString()
      });
      return tokenData.access_token;

    } catch (error) {
      console.error('Failed to refresh Google access token:', error);
      throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * トークンの有効性をチェック
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          access_token: accessToken
        })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Google Sheets APIリクエスト用の認証ヘッダーを取得
   */
  async getAuthHeaders(): Promise<{ Authorization: string }> {
    const accessToken = await this.getValidAccessToken();
    return {
      Authorization: `Bearer ${accessToken}`
    };
  }
}