import type { ConfigType } from '../../../db/schema';

export function convertConfigValue(value: string, type: ConfigType): string | number | boolean | Record<string, unknown> {
  switch (type) {
    case 'boolean':
      return value.toLowerCase() === 'true';
    case 'number': {
      const num = Number(value);
      return isNaN(num) ? value : num;
    }
    case 'json':
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return value;
      }
    case 'string':
    default:
      return value;
  }
}