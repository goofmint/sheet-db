/**
 * Tests for SettingValidator
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { SettingValidator } from './setting-validator';
import { SettingDefinitionService } from './setting-definition.service';

describe('SettingValidator', () => {
  let validator: SettingValidator;

  beforeEach(() => {
    const definitionService = new SettingDefinitionService();
    validator = new SettingValidator(definitionService);
  });

  test('isValidKey returns true for valid key', () => {
    expect(validator.isValidKey('max_file_size')).toBe(true);
    expect(validator.isValidKey('cache_ttl')).toBe(true);
  });

  test('isValidKey returns false for invalid key', () => {
    expect(validator.isValidKey('unknownKey')).toBe(false);
    expect(validator.isValidKey('')).toBe(false);
  });

  test('isValidValue validates number type correctly', () => {
    expect(validator.isValidValue('max_file_size', 5000000)).toBe(true);
    expect(validator.isValidValue('max_file_size', 'not a number')).toBe(false);
  });

  test('isValidValue validates boolean type correctly', () => {
    expect(validator.isValidValue('cache_enabled', true)).toBe(true);
    expect(validator.isValidValue('cache_enabled', false)).toBe(true);
    expect(validator.isValidValue('cache_enabled', 'yes')).toBe(false);
  });

  test('isValidValue validates string type correctly', () => {
    expect(validator.isValidValue('google_client_id', 'some-client-id')).toBe(true);
    expect(validator.isValidValue('google_client_id', 123)).toBe(false);
  });

  test('isValidValue validates array type correctly', () => {
    expect(validator.isValidValue('allowed_file_types', ['image/png', 'image/jpeg'])).toBe(true);
    expect(validator.isValidValue('allowed_file_types', 'not an array')).toBe(false);
  });

  test('isValidValue validates min/max constraints for numbers', () => {
    // max_file_size has min: 1024, max: 104857600
    expect(validator.isValidValue('max_file_size', 5000)).toBe(true);
    expect(validator.isValidValue('max_file_size', 500)).toBe(false); // Below min
    expect(validator.isValidValue('max_file_size', 200000000)).toBe(false); // Above max
  });

  test('normalizeValue converts values to string format', () => {
    expect(validator.normalizeValue('max_file_size', 10000)).toBe('10000');
    expect(validator.normalizeValue('cache_enabled', true)).toBe('true');
    expect(validator.normalizeValue('cache_enabled', false)).toBe('false');
  });

  test('normalizeValue converts arrays to JSON string', () => {
    const normalized = validator.normalizeValue('allowed_file_types', ['image/png', 'image/jpeg']);
    expect(normalized).toBe('["image/png","image/jpeg"]');
  });

  test('normalizeValue throws on invalid key', () => {
    expect(() => validator.normalizeValue('unknownKey', 'value')).toThrow();
  });

  test('normalizeValue throws on invalid value', () => {
    expect(() => validator.normalizeValue('max_file_size', 'not a number')).toThrow();
  });

  test('parseValue converts string back to correct type', () => {
    expect(validator.parseValue('max_file_size', '10000')).toBe(10000);
    expect(validator.parseValue('cache_enabled', 'true')).toBe(true);
    expect(validator.parseValue('cache_enabled', 'false')).toBe(false);
    expect(validator.parseValue('google_client_id', 'client-123')).toBe('client-123');
  });

  test('parseValue handles JSON arrays correctly', () => {
    const result = validator.parseValue('allowed_file_types', '["image/png","image/jpeg"]');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(['image/png', 'image/jpeg']);
  });

  test('parseValue handles invalid JSON gracefully for arrays', () => {
    const result = validator.parseValue('allowed_file_types', 'not-valid-json');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });
});
