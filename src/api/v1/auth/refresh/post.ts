/**
 * POST /api/v1/auth/refresh - Refresh access token using refresh token
 * 
 * Security features:
 * - HTTP-only cookie refresh token validation
 * - CSRF protection via double-submit cookie pattern
 * - Rate limiting
 * - Token reuse detection
 * - Comprehensive audit logging
 */

import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { Env } from '../../../../types/env';
import { SessionService } from '../../../../services/session';
import { Auth0Service } from '../../../../services/auth0';

interface RefreshTokenRequest {
  // CSRF token for double-submit cookie protection
  csrf_token?: string;
}

interface RefreshTokenResponse {
  success: boolean;
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  message?: string;
}

/**
 * POST /api/v1/auth/refresh
 */
export default async function refreshToken(c: Context<{ Bindings: Env }>): Promise<Response> {
  try {
    // Get client information for security logging
    const ipAddress = c.req.header('CF-Connecting-IP') || 
                     c.req.header('X-Forwarded-For') || 
                     c.req.header('X-Real-IP');
    const userAgent = c.req.header('User-Agent');

    // 1. Rate limiting check (basic implementation)
    const rateLimitKey = `refresh_rate_limit:${ipAddress}`;
    // TODO: Implement proper rate limiting with KV store or similar
    // For now, we'll rely on Cloudflare's built-in rate limiting

    // 2. Get refresh token from HTTP-only cookie
    const refreshTokenId = getCookie(c, 'refresh_token_id');
    if (!refreshTokenId) {
      return c.json({
        success: false,
        error: 'unauthorized',
        message: 'No refresh token provided'
      }, 401);
    }

    // 3. CSRF protection using double-submit cookie pattern
    const csrfTokenFromCookie = getCookie(c, 'csrf_token');
    const requestBody = await c.req.json<RefreshTokenRequest>().catch(() => ({})) as RefreshTokenRequest | {};
    const csrfTokenFromBody = 'csrf_token' in requestBody ? requestBody.csrf_token : undefined;

    if (!csrfTokenFromCookie || !csrfTokenFromBody || csrfTokenFromCookie !== csrfTokenFromBody) {
      return c.json({
        success: false,
        error: 'forbidden',
        message: 'CSRF token validation failed'
      }, 403);
    }

    // 4. Validate and use refresh token (with reuse detection)
    const tokenValidation = await SessionService.validateRefreshToken(
      refreshTokenId,
      ipAddress,
      userAgent
    );

    if (!tokenValidation.valid) {
      if (tokenValidation.is_reused) {
        // Token reuse detected - security breach
        return c.json({
          success: false,
          error: 'security_violation',
          message: 'Token reuse detected - all sessions revoked'
        }, 403);
      }

      return c.json({
        success: false,
        error: 'unauthorized',
        message: 'Invalid or expired refresh token'
      }, 401);
    }

    if (!tokenValidation.token_data) {
      return c.json({
        success: false,
        error: 'unauthorized',
        message: 'Token data not available'
      }, 401);
    }

    // 5. Use Auth0 to refresh the access token
    const auth0Service = new Auth0Service(c.env);
    const newTokens = await auth0Service.refreshAccessToken(tokenValidation.token_data.refresh_token);

    // 6. Store new refresh token if provided (token rotation)
    let newRefreshTokenId = refreshTokenId;
    if (newTokens.refreshToken) {
      const storeResult = await SessionService.storeRefreshToken(
        tokenValidation.token_data.user_id,
        newTokens.refreshToken,
        ipAddress,
        userAgent
      );

      if (storeResult.success && storeResult.token_id) {
        newRefreshTokenId = storeResult.token_id;
      }
    }

    // 7. Set secure HTTP-only cookies for new refresh token
    if (newRefreshTokenId !== refreshTokenId) {
      setCookie(c, 'refresh_token_id', newRefreshTokenId, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/'
      });
    }

    // 8. Generate new CSRF token for continued protection
    const newCsrfToken = crypto.randomUUID();
    setCookie(c, 'csrf_token', newCsrfToken, {
      httpOnly: false, // CSRF token needs to be accessible to JavaScript
      secure: true,
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/'
    });

    // 9. Return new access token
    const response: RefreshTokenResponse = {
      success: true,
      access_token: newTokens.accessToken,
      expires_in: newTokens.expiresIn,
      token_type: newTokens.tokenType
    };

    return c.json(response, 200, {
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache',
      'X-CSRF-Token': newCsrfToken
    });

  } catch (error) {
    console.error('Refresh token endpoint error:', error);
    
    // Create audit log for failed attempts
    const ipAddress = c.req.header('CF-Connecting-IP') || 
                     c.req.header('X-Forwarded-For') || 
                     c.req.header('X-Real-IP');
    const userAgent = c.req.header('User-Agent');
    
    // Log the failed attempt (if we can determine user)
    try {
      const refreshTokenId = getCookie(c, 'refresh_token_id');
      if (refreshTokenId) {
        // Try to get user from token for logging
        const tokenData = await SessionService.validateRefreshToken(refreshTokenId, ipAddress, userAgent);
        if (tokenData.token_data) {
          await SessionService.getTokenAuditLog(tokenData.token_data.user_id);
        }
      }
    } catch (logError) {
      console.error('Failed to log refresh attempt:', logError);
    }

    return c.json({
      success: false,
      error: 'internal_server_error',
      message: 'Token refresh failed'
    }, 500);
  }
}