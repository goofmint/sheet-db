import type { ConfigServiceDatabase } from './types';
import { ConfigCache } from './cache';
import { ConfigDatabase } from './database';

/**
 * Initialization handler for ConfigService
 * Manages initialization state and cache refresh
 */
export class ConfigInitializer {
	private static initialized = false;

	/**
	 * Initialize the ConfigService with database connection
	 * Must be called at application startup
	 */
	static async initialize(database: ConfigServiceDatabase): Promise<void> {
		ConfigDatabase.initialize(database);
		await this.refreshCache();
		// await this.initializeMasterKeyConfig();
		this.initialized = true;
	}

	/**
	 * Refresh cache from database
	 * Loads all config entries into memory
	 */
	static async refreshCache(): Promise<void> {
		const configs = await ConfigDatabase.loadAll();
		ConfigCache.loadAll(configs);
	}

	/**
	 * Check if ConfigService is initialized
	 */
	static isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Ensure ConfigService is initialized
	 */
	static ensureInitialized(): void {
		if (!this.initialized) {
			throw new Error('ConfigService not initialized. Call ConfigService.initialize() first.');
		}
	}

}
