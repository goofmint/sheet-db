/**
 * Cryptographic utilities for encryption/decryption
 *
 * Uses Web Crypto API for AES-GCM encryption with PBKDF2 key derivation
 * Compatible with Cloudflare Workers runtime
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM
const SALT_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

/**
 * Derives an encryption key from a passphrase using PBKDF2
 */
async function deriveKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext using AES-GCM
 *
 * @param plaintext - String to encrypt
 * @param passphrase - Encryption passphrase (from environment variable)
 * @returns Base64-encoded encrypted data with IV and salt
 */
export async function encrypt(
  plaintext: string,
  passphrase: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive key from passphrase
  const key = await deriveKey(passphrase, salt);

  // Encrypt data
  const encrypted = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
    },
    key,
    data
  );

  // Combine salt + IV + encrypted data
  const combined = new Uint8Array(
    salt.length + iv.length + encrypted.byteLength
  );
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  // Return base64-encoded result
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts ciphertext using AES-GCM
 *
 * @param ciphertext - Base64-encoded encrypted data
 * @param passphrase - Decryption passphrase (from environment variable)
 * @returns Decrypted plaintext string
 */
export async function decrypt(
  ciphertext: string,
  passphrase: string
): Promise<string> {
  // Decode base64
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

  // Extract salt, IV, and encrypted data
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH);

  // Derive key from passphrase
  const key = await deriveKey(passphrase, salt);

  // Decrypt data
  const decrypted = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv,
    },
    key,
    encrypted
  );

  // Return decrypted string
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
