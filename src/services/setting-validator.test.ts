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
    expect(validator.isValidKey('maxFileSize')).toBe(true);
    expect(validator.isValidKey('cacheTTL')).toBe(true);
  });

  test('isValidKey returns false for invalid key', () => {
    expect(validator.isValidKey('unknownKey')).toBe(false);
    expect(validator.isValidKey('')).toBe(false);
  });

  test('isValidValue validates number type correctly', () => {
    expect(validator.isValidValue('maxFileSize', 5000000)).toBe(true);
    expect(validator.isValidValue('maxFileSize', 'not a number')).toBe(false);
  });

  test('isValidValue validates boolean type correctly', () => {
    expect(validator.isValidValue('cacheEnabled', true)).toBe(true);
    expect(validator.isValidValue('cacheEnabled', false)).toBe(true);
    expect(validator.isValidValue('cacheEnabled', 'yes')).toBe(false);
  });

  test('isValidValue validates string type correctly', () => {
    expect(validator.isValidValue('googleClientId', 'some-client-id')).toBe(true);
    expect(validator.isValidValue('googleClientId', 123)).toBe(false);
  });

  test('isValidValue validates array type correctly', () => {
    expect(validator.isValidValue('allowedFileTypes', ['image/png', 'image/jpeg'])).toBe(true);
    expect(validator.isValidValue('allowedFileTypes', 'not an array')).toBe(false);
  });

  test('isValidValue validates min/max constraints for numbers', () => {
    // maxFileSize has min: 1024, max: 104857600
    expect(validator.isValidValue('maxFileSize', 5000)).toBe(true);
    expect(validator.isValidValue('maxFileSize', 500)).toBe(false); // Below min
    expect(validator.isValidValue('maxFileSize', 200000000)).toBe(false); // Above max
  });

  test('normalizeValue converts values to string format', () => {
    expect(validator.normalizeValue('maxFileSize', 10000)).toBe('10000');
    expect(validator.normalizeValue('cacheEnabled', true)).toBe('true');
    expect(validator.normalizeValue('cacheEnabled', false)).toBe('false');
  });

  test('normalizeValue converts arrays to JSON string', () => {
    const normalized = validator.normalizeValue('allowedFileTypes', ['image/png', 'image/jpeg']);
    expect(normalized).toBe('["image/png","image/jpeg"]');
  });

  test('normalizeValue throws on invalid key', () => {
    expect(() => validator.normalizeValue('unknownKey', 'value')).toThrow();
  });

  test('normalizeValue throws on invalid value', () => {
    expect(() => validator.normalizeValue('maxFileSize', 'not a number')).toThrow();
  });

  test('parseValue converts string back to correct type', () => {
    expect(validator.parseValue('maxFileSize', '10000')).toBe(10000);
    expect(validator.parseValue('cacheEnabled', 'true')).toBe(true);
    expect(validator.parseValue('cacheEnabled', 'false')).toBe(false);
    expect(validator.parseValue('googleClientId', 'client-123')).toBe('client-123');
  });

  test('parseValue handles JSON arrays correctly', () => {
    const result = validator.parseValue('allowedFileTypes', '["image/png","image/jpeg"]');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(['image/png', 'image/jpeg']);
  });

  test('parseValue handles invalid JSON gracefully for arrays', () => {
    const result = validator.parseValue('allowedFileTypes', 'not-valid-json');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });
});
