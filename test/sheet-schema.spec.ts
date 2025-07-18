import { describe, it, expect, beforeEach } from 'vitest';
import { SheetsSetupManager } from '../src/sheet-schema';

describe('Sheet Schema Comparison', () => {
  // Create a test instance to access private methods
  class TestSheetsSetupManager extends SheetsSetupManager {
    public testSchemaRowsEqual(a: any[], b: any[]): boolean {
      return (this as any).schemaRowsEqual(a, b);
    }
    
    public testDeepEquals(a: any, b: any): boolean {
      return (this as any).deepEquals(a, b);
    }
    
    public testIsValidJSON(str: string): boolean {
      return (this as any).isValidJSON(str);
    }
    
    public testSafeJSONParse(str: string): any | null {
      return (this as any).safeJSONParse(str);
    }
  }

  let testManager: TestSheetsSetupManager;
  
  beforeEach(() => {
    testManager = new TestSheetsSetupManager({
      spreadsheetId: 'test',
      accessToken: 'test'
    });
  });

  describe('deepEquals method security improvements', () => {
    it('should handle primitive values correctly', () => {
      expect(testManager.testDeepEquals(1, 1)).toBe(true);
      expect(testManager.testDeepEquals('test', 'test')).toBe(true);
      expect(testManager.testDeepEquals(true, true)).toBe(true);
      expect(testManager.testDeepEquals(null, null)).toBe(true);
      expect(testManager.testDeepEquals(undefined, undefined)).toBe(true);
      
      expect(testManager.testDeepEquals(1, 2)).toBe(false);
      expect(testManager.testDeepEquals('test', 'other')).toBe(false);
      expect(testManager.testDeepEquals(true, false)).toBe(false);
      expect(testManager.testDeepEquals(null, undefined)).toBe(false);
    });

    it('should handle arrays correctly', () => {
      expect(testManager.testDeepEquals([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(testManager.testDeepEquals(['a', 'b'], ['a', 'b'])).toBe(true);
      expect(testManager.testDeepEquals([], [])).toBe(true);
      
      expect(testManager.testDeepEquals([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(testManager.testDeepEquals([1, 2], [1, 2, 3])).toBe(false);
    });

    it('should handle objects correctly', () => {
      expect(testManager.testDeepEquals({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(testManager.testDeepEquals({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
      expect(testManager.testDeepEquals({}, {})).toBe(true);
      
      expect(testManager.testDeepEquals({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
      expect(testManager.testDeepEquals({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it('should handle JSON.stringify ordering issues', () => {
      const obj1 = { b: 2, a: 1, c: 3 };
      const obj2 = { a: 1, b: 2, c: 3 };
      
      expect(testManager.testDeepEquals(obj1, obj2)).toBe(true);
      expect(JSON.stringify(obj1) === JSON.stringify(obj2)).toBe(false);
    });
  });

  describe('JSON validation security improvements', () => {
    it('should validate JSON strings correctly', () => {
      expect(testManager.testIsValidJSON('{"valid": "json"}')).toBe(true);
      expect(testManager.testIsValidJSON('{ "key": "value" }')).toBe(true);
      expect(testManager.testIsValidJSON('{}')).toBe(true);
      
      expect(testManager.testIsValidJSON('')).toBe(false);
      expect(testManager.testIsValidJSON('not json')).toBe(false);
      expect(testManager.testIsValidJSON('{"invalid": json}')).toBe(false);
      expect(testManager.testIsValidJSON('[1, 2, 3]')).toBe(false);
      expect(testManager.testIsValidJSON('null')).toBe(false);
      expect(testManager.testIsValidJSON('123')).toBe(false);
    });

    it('should parse valid JSON objects safely', () => {
      expect(testManager.testSafeJSONParse('{"key": "value"}')).toEqual({ key: 'value' });
      expect(testManager.testSafeJSONParse('{}')).toEqual({});
      expect(testManager.testSafeJSONParse('{"nested": {"value": 1}}')).toEqual({ nested: { value: 1 } });
    });

    it('should return null for invalid or non-object JSON', () => {
      expect(testManager.testSafeJSONParse('invalid json')).toBe(null);
      expect(testManager.testSafeJSONParse('[1, 2, 3]')).toBe(null);
      expect(testManager.testSafeJSONParse('null')).toBe(null);
      expect(testManager.testSafeJSONParse('123')).toBe(null);
      expect(testManager.testSafeJSONParse('"string"')).toBe(null);
      expect(testManager.testSafeJSONParse('')).toBe(null);
    });

    it('should prevent prototype pollution attacks', () => {
      const maliciousJSON = '{"__proto__": {"isAdmin": true}}';
      const result = testManager.testSafeJSONParse(maliciousJSON);
      
      // The parsed object should contain __proto__ as a regular property
      expect(result).toHaveProperty('__proto__');
      expect(result!.__proto__).toEqual({ isAdmin: true });
      
      // But it should not pollute the prototype chain
      expect(({} as any).isAdmin).toBeUndefined();
    });
  });

  describe('schemaRowsEqual with security improvements', () => {
    it('should match identical simple type arrays', () => {
      const a = ['string', 'number', 'boolean'];
      const b = ['string', 'number', 'boolean'];
      expect(testManager.testSchemaRowsEqual(a, b)).toBe(true);
    });

    it('should match identical JSON schema arrays', () => {
      const a = [
        '{"type":"string","required":true}',
        '{"type":"number","min":0}',
        'boolean'
      ];
      const b = [
        '{"type":"string","required":true}',
        '{"type":"number","min":0}',
        'boolean'
      ];
      expect(testManager.testSchemaRowsEqual(a, b)).toBe(true);
    });

    it('should match equivalent schemas (simple vs JSON)', () => {
      const a = ['string', 'number'];
      const b = ['{"type":"string"}', '{"type":"number"}'];
      expect(testManager.testSchemaRowsEqual(a, b)).toBe(true);
    });

    it('should detect differences in JSON schemas', () => {
      const a = ['{"type":"string","required":true}'];
      const b = ['{"type":"string","required":false}'];
      expect(testManager.testSchemaRowsEqual(a, b)).toBe(false);
    });

    it('should detect type differences', () => {
      const a = ['string'];
      const b = ['number'];
      expect(testManager.testSchemaRowsEqual(a, b)).toBe(false);
    });

    it('should handle different array lengths', () => {
      const a = ['string', 'number'];
      const b = ['string'];
      expect(testManager.testSchemaRowsEqual(a, b)).toBe(false);
    });

    it('should handle empty values', () => {
      const a = ['string', '', 'number'];
      const b = ['string', '', 'number'];
      expect(testManager.testSchemaRowsEqual(a, b)).toBe(true);
    });

    it('should handle malformed JSON gracefully', () => {
      const a = ['{malformed json}'];
      const b = ['{malformed json}'];
      expect(testManager.testSchemaRowsEqual(a, b)).toBe(true);
    });

    it('should use deepEquals for JSON object comparison', () => {
      const row1 = ['{"type": "string", "required": true}', '{"type": "number"}'];
      const row2 = ['{"required": true, "type": "string"}', '{"type": "number"}'];
      
      expect(testManager.testSchemaRowsEqual(row1, row2)).toBe(true);
    });

    it('should not throw on malicious JSON input', () => {
      const maliciousInputs = [
        '{"__proto__": {"polluted": true}}',
        '{"constructor": {"prototype": {"polluted": true}}}',
        '{"toString": "malicious"}',
        '{"valueOf": "malicious"}'
      ];
      
      maliciousInputs.forEach(input => {
        expect(() => testManager.testSchemaRowsEqual([input], [input])).not.toThrow();
      });
    });
  });
});