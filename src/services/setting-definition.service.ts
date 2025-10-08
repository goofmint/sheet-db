/**
 * Setting Definition Service
 * Manages setting definitions (metadata) for the configuration system
 * New settings can be added by updating src/config/setting-definitions.ts
 */

import type { SettingDefinition } from '../types/settings';
import { SETTING_DEFINITIONS } from '../config/setting-definitions';

/**
 * Service that provides setting definitions for all system settings
 * Centralizes the configuration schema to make adding new settings easy
 */
export class SettingDefinitionService {
  private definitions: SettingDefinition[];

  constructor() {
    // Load all setting definitions from centralized config
    this.definitions = SETTING_DEFINITIONS;
  }

  /**
   * Get all setting definitions
   * @returns Array of all setting definitions
   */
  getAllDefinitions(): SettingDefinition[] {
    return this.definitions;
  }

  /**
   * Get setting definitions filtered by category
   * @param category - Category to filter by (e.g., 'google', 'file', 'security')
   * @returns Array of setting definitions in the specified category
   */
  getDefinitionsByCategory(category: string): SettingDefinition[] {
    return this.definitions.filter((def) => def.category === category);
  }

  /**
   * Get a specific setting definition by key
   * @param key - Setting key to look up
   * @returns Setting definition or null if not found
   */
  getDefinition(key: string): SettingDefinition | null {
    return this.definitions.find((def) => def.key === key) ?? null;
  }
}
