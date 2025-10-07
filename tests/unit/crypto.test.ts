/**
 * Unit tests for encryption/decryption utilities
 *
 * Tests AES-GCM encryption with PBKDF2 key derivation
 */

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../../src/utils/crypto';

describe('Crypto Utilities', () => {
  const passphrase = 'test-encryption-passphrase-32-chars-long';

  describe('Encryption', () => {
    it('should encrypt plaintext', async () => {
      const plaintext = 'sensitive data';
      const encrypted = await encrypt(plaintext, passphrase);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should produce different ciphertext each time (random IV)', async () => {
      const plaintext = 'same data';

      const encrypted1 = await encrypt(plaintext, passphrase);
      const encrypted2 = await encrypt(plaintext, passphrase);

      // Different IVs should produce different ciphertext
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should encrypt empty string', async () => {
      const encrypted = await encrypt('', passphrase);

      expect(encrypted).toBeTruthy();
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should encrypt special characters', async () => {
      const plaintext = '!@#$%^&*()_+{}|:"<>?[];\',./ 日本語';
      const encrypted = await encrypt(plaintext, passphrase);

      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);
    });
  });

  describe('Decryption', () => {
    it('should decrypt ciphertext', async () => {
      const plaintext = 'secret message';
      const encrypted = await encrypt(plaintext, passphrase);
      const decrypted = await decrypt(encrypted, passphrase);

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt empty string', async () => {
      const encrypted = await encrypt('', passphrase);
      const decrypted = await decrypt(encrypted, passphrase);

      expect(decrypted).toBe('');
    });

    it('should decrypt special characters', async () => {
      const plaintext = 'Special: !@#$%^&*() 日本語 🚀';
      const encrypted = await encrypt(plaintext, passphrase);
      const decrypted = await decrypt(encrypted, passphrase);

      expect(decrypted).toBe(plaintext);
    });

    it('should fail with wrong passphrase', async () => {
      const plaintext = 'secret data';
      const encrypted = await encrypt(plaintext, passphrase);

      const wrongPassphrase = 'wrong-passphrase';

      await expect(decrypt(encrypted, wrongPassphrase)).rejects.toThrow();
    });

    it('should fail with tampered ciphertext', async () => {
      const plaintext = 'secret data';
      const encrypted = await encrypt(plaintext, passphrase);

      // Tamper with ciphertext
      const tampered = encrypted.slice(0, -5) + 'xxxxx';

      await expect(decrypt(tampered, passphrase)).rejects.toThrow();
    });

    it('should fail with invalid base64', async () => {
      const invalid = 'not-valid-base64!!!';

      await expect(decrypt(invalid, passphrase)).rejects.toThrow();
    });
  });

  describe('Encryption/Decryption Round Trip', () => {
    it('should maintain data integrity for long text', async () => {
      const plaintext = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(
        100
      );
      const encrypted = await encrypt(plaintext, passphrase);
      const decrypted = await decrypt(encrypted, passphrase);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle JSON data', async () => {
      const jsonData = JSON.stringify({
        user: 'admin',
        password: 'secret123',
        nested: { key: 'value' },
      });

      const encrypted = await encrypt(jsonData, passphrase);
      const decrypted = await decrypt(encrypted, passphrase);

      expect(decrypted).toBe(jsonData);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonData));
    });

    it('should handle multiple passphrases', async () => {
      const plaintext = 'multi-tenant data';
      const passphrase1 = 'tenant-1-key';
      const passphrase2 = 'tenant-2-key';

      const encrypted1 = await encrypt(plaintext, passphrase1);
      const encrypted2 = await encrypt(plaintext, passphrase2);

      // Decrypt with correct passphrases
      expect(await decrypt(encrypted1, passphrase1)).toBe(plaintext);
      expect(await decrypt(encrypted2, passphrase2)).toBe(plaintext);

      // Decrypt with wrong passphrases should fail
      await expect(decrypt(encrypted1, passphrase2)).rejects.toThrow();
      await expect(decrypt(encrypted2, passphrase1)).rejects.toThrow();
    });
  });
});
