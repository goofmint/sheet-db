import type { ConfigType } from '../../../db/schema';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function convertConfigValue(value: string, type: ConfigType): string | number | boolean | JsonValue {
  switch (type) {
    case 'boolean':
      return value.toLowerCase() === 'true';
    case 'number': {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }
    case 'json':
      try {
        return JSON.parse(value) as JsonValue;
      } catch {
        return value;
      }
    case 'string':
    default:
      return value;
  }
}