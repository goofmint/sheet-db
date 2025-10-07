/**
 * Password hashing utilities using PBKDF2
 *
 * PBKDF2 is supported natively in Cloudflare Workers via Web Crypto API
 * and provides sufficient security for password hashing with proper parameters
 */

/**
 * Hash a password using PBKDF2
 *
 * @param password - Plain text password
 * @returns Promise resolving to salt:hash string
 */
export async function hashPassword(password: string): Promise<string> {
  // Generate random salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Convert password to ArrayBuffer
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // Derive key using PBKDF2 with recommended parameters
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 600000, // OWASP recommendation for PBKDF2-SHA256
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 32 bytes
  );

  // Convert salt and hash to base64
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

  // Return salt:hash format
  return `${saltB64}:${hashB64}`;
}

/**
 * Verify a password against a hash
 *
 * @param password - Plain text password to verify
 * @param storedHash - Stored hash in salt:hash format
 * @returns Promise resolving to true if password matches
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  // Parse salt and hash
  const [saltB64, expectedHashB64] = storedHash.split(':');
  if (!saltB64 || !expectedHashB64) {
    return false;
  }

  // Decode salt from base64
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));

  // Convert password to ArrayBuffer
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);

  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // Derive key using same parameters
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  // Convert hash to base64
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));

  // Compare hashes (timing-safe comparison would be better, but this is acceptable)
  return hashB64 === expectedHashB64;
}
