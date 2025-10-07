/**
 * OAuth State Management Utilities
 *
 * Implements signed cookie approach for CSRF protection
 * Uses HMAC-SHA256 to sign state tokens
 */

/**
 * Sign a state token with HMAC-SHA256
 *
 * @param stateToken - Random state token
 * @param secret - Secret key from environment
 * @returns Signed state in format "token.signature"
 */
export async function signState(
  stateToken: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();

  // Import secret as HMAC key
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the state token
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(stateToken)
  );

  // Convert signature to base64
  const signatureB64 = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  );

  // Return format: token.signature
  return `${stateToken}.${signatureB64}`;
}

/**
 * Verify a signed state token
 *
 * @param signedState - Signed state from cookie
 * @param expectedState - State from query parameter
 * @param secret - Secret key from environment
 * @returns True if signature is valid and states match
 */
export async function verifyState(
  signedState: string,
  expectedState: string,
  secret: string
): Promise<boolean> {
  // Parse signed state
  const parts = signedState.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [cookieState, signatureB64] = parts;

  // First check if states match
  if (cookieState !== expectedState) {
    return false;
  }

  const encoder = new TextEncoder();

  // Import secret as HMAC key
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Convert base64 signature back to ArrayBuffer
  let signature: Uint8Array;
  try {
    signature = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
  } catch {
    // Invalid base64 encoding
    return false;
  }

  // Verify signature
  try {
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(cookieState)
    );
    return isValid;
  } catch {
    // Verification error
    return false;
  }
}
