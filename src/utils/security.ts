/**
 * Security utilities for safe operations
 */

import { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

/**
 * Constant-time string comparison to prevent timing attacks
 * 
 * This function compares two strings in constant time regardless of their content,
 * preventing attackers from using timing differences to infer information about
 * the expected string.
 * 
 * @param a First string to compare
 * @param b Second string to compare
 * @returns true if strings are equal, false otherwise
 */
export function constantTimeEquals(a: string, b: string): boolean {
  // If lengths differ, we still need to do a full comparison to avoid timing leaks
  const aLength = a.length;
  const bLength = b.length;
  const maxLength = Math.max(aLength, bLength);
  
  let result = aLength === bLength ? 0 : 1;
  
  // Compare each character, always doing the full comparison
  for (let i = 0; i < maxLength; i++) {
    const aChar = i < aLength ? a.charCodeAt(i) : 0;
    const bChar = i < bLength ? b.charCodeAt(i) : 0;
    result |= aChar ^ bChar;
  }
  
  return result === 0;
}

/**
 * Alternative implementation using Web Crypto API's subtle.timingSafeEqual if available
 * Falls back to constantTimeEquals for environments where it's not available
 * 
 * @param a First string to compare
 * @param b Second string to compare
 * @returns Promise<boolean> true if strings are equal, false otherwise
 */
export async function timingSafeEquals(a: string, b: string): Promise<boolean> {
  try {
    // Convert strings to Uint8Array for crypto.subtle.timingSafeEqual
    const encoder = new TextEncoder();
    const aBytes = encoder.encode(a);
    const bBytes = encoder.encode(b);
    
    // If lengths differ, pad the shorter one to prevent length-based timing attacks
    const maxLength = Math.max(aBytes.length, bBytes.length);
    const aPadded = new Uint8Array(maxLength);
    const bPadded = new Uint8Array(maxLength);
    
    aPadded.set(aBytes);
    bPadded.set(bBytes);
    
    // Use crypto.subtle.timingSafeEqual if available (Cloudflare Workers support)
    if (typeof crypto !== 'undefined' && crypto.subtle && 'timingSafeEqual' in crypto.subtle) {
      return (crypto.subtle as SubtleCrypto & { timingSafeEqual?: (a: ArrayBuffer, b: ArrayBuffer) => boolean }).timingSafeEqual!(aPadded, bPadded);
    }
  } catch (error) {
    // Fall back to our implementation if crypto API is not available
  }
  
  // Fallback to our constant-time implementation
  return constantTimeEquals(a, b);
}

/**
 * Validate and sanitize an access token
 * 
 * Google OAuth 2.0 access tokens typically:
 * - Are 20-2048 characters long
 * - Contain only alphanumeric characters, periods, slashes, underscores, and hyphens
 * - Start with "ya29." for user tokens or other specific prefixes
 * 
 * @param token The access token to validate
 * @returns The sanitized token if valid, null if invalid
 */
export function validateAccessToken(token: string | null | undefined): string | null {
  if (!token || typeof token !== 'string') {
    return null;
  }
  
  // Trim whitespace
  const trimmedToken = token.trim();
  
  // Check length constraints (reasonable bounds for OAuth tokens)
  if (trimmedToken.length < 10 || trimmedToken.length > 2048) {
    return null;
  }
  
  // Check for valid characters only (OAuth tokens should only contain these)
  // Allow: alphanumeric, periods, slashes, underscores, hyphens, plus signs
  const validTokenPattern = /^[a-zA-Z0-9._/-]+$/;
  if (!validTokenPattern.test(trimmedToken)) {
    return null;
  }
  
  // Additional check for common OAuth token patterns
  // Google tokens often start with specific prefixes
  const hasValidPrefix = /^(ya29\.|1\/\/|gho_|ghp_|[a-zA-Z0-9])/.test(trimmedToken);
  if (!hasValidPrefix) {
    return null;
  }
  
  return trimmedToken;
}

/**
 * Sanitize a string input to prevent injection attacks
 * 
 * @param input The input string to sanitize
 * @param maxLength Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeInput(input: string | null | undefined, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Trim and limit length
  let sanitized = input.trim().substring(0, maxLength);
  
  // Remove null bytes and control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized;
}

// Session token configuration
const SESSION_COOKIE_NAME = 'config_session';
const CSRF_COOKIE_NAME = 'csrf_token';
const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

/**
 * Generate a cryptographically secure random token
 */
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  // Use crypto.getRandomValues if available (Cloudflare Workers)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  
  return result;
}

/**
 * Create a session token with HMAC signature
 */
export async function createSessionToken(secret: string): Promise<string> {
  const sessionId = generateSecureToken(32);
  const timestamp = Date.now().toString();
  const payload = `${sessionId}:${timestamp}`;
  
  // Create HMAC signature
  const signature = await createHMAC(payload, secret);
  return `${payload}:${signature}`;
}

/**
 * Verify a session token
 */
export async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split(':');
    if (parts.length !== 3) return false;
    
    const [sessionId, timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    
    // Check if token is expired
    if (Date.now() - timestamp > SESSION_DURATION) {
      return false;
    }
    
    // Verify HMAC signature
    const payload = `${sessionId}:${timestampStr}`;
    const expectedSignature = await createHMAC(payload, secret);
    
    return await timingSafeEquals(signature, expectedSignature);
  } catch {
    return false;
  }
}

/**
 * Create HMAC signature using Web Crypto API
 */
async function createHMAC(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  return generateSecureToken(32);
}

/**
 * Verify CSRF token
 */
export function verifyCSRFToken(submittedToken: string, storedToken: string): boolean {
  if (!submittedToken || !storedToken) return false;
  return constantTimeEquals(submittedToken, storedToken);
}

/**
 * Set secure session cookie
 */
export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Strict',
    maxAge: SESSION_DURATION / 1000, // Convert to seconds
    path: '/'
  });
}

/**
 * Set CSRF token cookie
 */
export function setCSRFCookie(c: Context, token: string): void {
  setCookie(c, CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Needs to be accessible to JavaScript for form submission
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Strict',
    maxAge: SESSION_DURATION / 1000,
    path: '/'
  });
}

/**
 * Get session token from cookie
 */
export function getSessionToken(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE_NAME);
}

/**
 * Get CSRF token from cookie
 */
export function getCSRFToken(c: Context): string | undefined {
  return getCookie(c, CSRF_COOKIE_NAME);
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(c: Context): void {
  setCookie(c, SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Strict',
    maxAge: 0,
    path: '/'
  });
}

/**
 * Clear session and CSRF cookies
 */
export function clearAuthCookies(c: Context): void {
  setCookie(c, SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Strict',
    maxAge: 0,
    path: '/'
  });
  
  setCookie(c, CSRF_COOKIE_NAME, '', {
    httpOnly: false,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Strict',
    maxAge: 0,
    path: '/'
  });
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(c: Context, secret: string): Promise<boolean> {
  const sessionToken = getSessionToken(c);
  if (!sessionToken) return false;
  
  return await verifySessionToken(sessionToken, secret);
}