/**
 * Unit tests for OAuth state signing and verification
 *
 * Tests HMAC-SHA256 signing for CSRF protection
 */

import { describe, it, expect } from 'vitest';
import { signState, verifyState } from '../../src/utils/oauth-state';

describe('OAuth State Management', () => {
  const secret = 'test-secret-key-for-hmac-signing-32chars';

  describe('State Signing', () => {
    it('should sign a state token', async () => {
      const stateToken = 'random-state-token-123';
      const signed = await signState(stateToken, secret);

      expect(signed).toContain('.');
      const [token, signature] = signed.split('.');
      expect(token).toBe(stateToken);
      expect(signature).toBeTruthy();
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should produce different signatures for different secrets', async () => {
      const stateToken = 'same-token';
      const secret1 = 'secret1';
      const secret2 = 'secret2';

      const signed1 = await signState(stateToken, secret1);
      const signed2 = await signState(stateToken, secret2);

      expect(signed1).not.toBe(signed2);
    });

    it('should produce deterministic signatures', async () => {
      const stateToken = 'deterministic-token';

      const signed1 = await signState(stateToken, secret);
      const signed2 = await signState(stateToken, secret);

      expect(signed1).toBe(signed2);
    });
  });

  describe('State Verification', () => {
    it('should verify valid signed state', async () => {
      const stateToken = 'valid-state-token';
      const signed = await signState(stateToken, secret);

      const isValid = await verifyState(signed, stateToken, secret);
      expect(isValid).toBe(true);
    });

    it('should reject tampered state token', async () => {
      const stateToken = 'original-token';
      const signed = await signState(stateToken, secret);

      const tamperedState = 'tampered-token';
      const isValid = await verifyState(signed, tamperedState, secret);
      expect(isValid).toBe(false);
    });

    it('should reject tampered signature', async () => {
      const stateToken = 'state-token';
      const signed = await signState(stateToken, secret);

      // Tamper with signature
      const [token, signature] = signed.split('.');
      const tamperedSigned = `${token}.${signature}abc`;

      const isValid = await verifyState(tamperedSigned, stateToken, secret);
      expect(isValid).toBe(false);
    });

    it('should reject when using wrong secret', async () => {
      const stateToken = 'state-token';
      const signed = await signState(stateToken, secret);

      const wrongSecret = 'wrong-secret-key';
      const isValid = await verifyState(signed, stateToken, wrongSecret);
      expect(isValid).toBe(false);
    });

    it('should reject malformed signed state', async () => {
      const stateToken = 'state-token';
      const malformed = 'no-signature-here';

      const isValid = await verifyState(malformed, stateToken, secret);
      expect(isValid).toBe(false);
    });

    it('should reject when state does not match', async () => {
      const stateToken1 = 'state-1';
      const stateToken2 = 'state-2';

      const signed = await signState(stateToken1, secret);
      const isValid = await verifyState(signed, stateToken2, secret);

      expect(isValid).toBe(false);
    });
  });

  describe('CSRF Protection', () => {
    it('should prevent CSRF attack with state mismatch', async () => {
      // Attacker generates their own state
      const attackerState = 'attacker-state';
      const attackerSigned = await signState(attackerState, secret);

      // User's actual state is different
      const userState = 'user-state';

      // Verification should fail
      const isValid = await verifyState(attackerSigned, userState, secret);
      expect(isValid).toBe(false);
    });

    it('should prevent signature forgery without secret', async () => {
      const stateToken = 'some-token';

      // Attacker tries to forge signature without knowing secret
      const forgedSigned = `${stateToken}.ZmFrZXNpZ25hdHVyZQ==`;

      const isValid = await verifyState(forgedSigned, stateToken, secret);
      expect(isValid).toBe(false);
    });
  });
});
