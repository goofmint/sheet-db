/**
 * Tests for SettingDefinitionService
 */

import { describe, test, expect } from 'vitest';
import { SettingDefinitionService } from './setting-definition.service';

describe('SettingDefinitionService', () => {
  test('getAllDefinitions returns all setting definitions', () => {
    const service = new SettingDefinitionService();
    const definitions = service.getAllDefinitions();

    expect(definitions).toBeDefined();
    expect(Array.isArray(definitions)).toBe(true);
    expect(definitions.length).toBeGreaterThan(0);
  });

  test('getDefinitionsByCategory filters definitions by category', () => {
    const service = new SettingDefinitionService();
    const googleDefs = service.getDefinitionsByCategory('google');

    expect(Array.isArray(googleDefs)).toBe(true);
    expect(googleDefs.every((def) => def.category === 'google')).toBe(true);
  });

  test('getDefinition returns specific definition by key', () => {
    const service = new SettingDefinitionService();
    const def = service.getDefinition('maxFileSize');

    expect(def).toBeDefined();
    expect(def?.key).toBe('maxFileSize');
    expect(def?.type).toBe('number');
  });

  test('getDefinition returns null for unknown key', () => {
    const service = new SettingDefinitionService();
    const def = service.getDefinition('unknownKey');

    expect(def).toBeNull();
  });

  test('all definitions have required fields', () => {
    const service = new SettingDefinitionService();
    const definitions = service.getAllDefinitions();

    definitions.forEach((def) => {
      expect(def.key).toBeDefined();
      expect(def.label).toBeDefined();
      expect(def.description).toBeDefined();
      expect(def.category).toBeDefined();
      expect(def.type).toBeDefined();
      expect(def.defaultValue).toBeDefined();
    });
  });
});
