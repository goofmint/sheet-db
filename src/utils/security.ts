/**
 * Security utilities for safe operations
 */

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