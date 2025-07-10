/**
 * Enhanced data validation utility for sheet data insertion
 */

import { logger } from './logger';

export interface ValidationResult {
	valid: boolean;
	error?: string;
	sanitizedData?: any;
}

export interface ValidationOptions {
	maxStringLength?: number;
	maxArrayLength?: number;
	maxObjectDepth?: number;
	allowedTypes?: string[];
	disallowedKeys?: string[];
	maxTotalSize?: number; // Maximum total size in bytes
}

const DEFAULT_OPTIONS: ValidationOptions = {
	maxStringLength: 10000,
	maxArrayLength: 1000,
	maxObjectDepth: 10,
	allowedTypes: ['string', 'number', 'boolean', 'object'],
	disallowedKeys: ['__proto__', 'constructor', 'prototype'],
	maxTotalSize: 1024 * 1024 // 1MB
};

export class DataValidator {
	private options: ValidationOptions;

	constructor(options: Partial<ValidationOptions> = {}) {
		this.options = { ...DEFAULT_OPTIONS, ...options };
	}

	/**
	 * Validates and sanitizes input data
	 */
	async validateInputData(data: any, context: string = 'unknown'): Promise<ValidationResult> {
		try {
			// Check total size
			const dataSize = this.calculateDataSize(data);
			if (dataSize > this.options.maxTotalSize!) {
				logger.warn('Data validation failed: size limit exceeded', { 
					context, 
					dataSize, 
					maxSize: this.options.maxTotalSize 
				});
				return {
					valid: false,
					error: `Data size exceeds limit of ${this.options.maxTotalSize} bytes`
				};
			}

			// Validate and sanitize data
			const sanitizedData = this.sanitizeData(data, 0);
			
			// Additional security checks
			const securityCheck = this.performSecurityChecks(sanitizedData);
			if (!securityCheck.valid) {
				logger.warn('Data validation failed: security check', { 
					context, 
					error: securityCheck.error 
				});
				return securityCheck;
			}

			logger.debug('Data validation passed', { context, dataSize });
			return {
				valid: true,
				sanitizedData
			};

		} catch (error) {
			logger.error('Data validation error', { context, error });
			return {
				valid: false,
				error: 'Data validation failed'
			};
		}
	}

	/**
	 * Calculates approximate data size in bytes
	 */
	private calculateDataSize(data: any): number {
		return new Blob([JSON.stringify(data)]).size;
	}

	/**
	 * Recursively sanitizes data
	 */
	private sanitizeData(data: any, depth: number): any {
		if (depth > this.options.maxObjectDepth!) {
			throw new Error('Maximum object depth exceeded');
		}

		if (data === null || data === undefined) {
			return data;
		}

		const dataType = typeof data;
		
		// Check allowed types
		if (!this.options.allowedTypes!.includes(dataType)) {
			throw new Error(`Data type '${dataType}' not allowed`);
		}

		switch (dataType) {
			case 'string':
				return this.sanitizeString(data);
			
			case 'number':
				return this.sanitizeNumber(data);
			
			case 'boolean':
				return data;
			
			case 'object':
				if (Array.isArray(data)) {
					return this.sanitizeArray(data, depth);
				} else {
					return this.sanitizeObject(data, depth);
				}
			
			default:
				throw new Error(`Unsupported data type: ${dataType}`);
		}
	}

	/**
	 * Sanitizes string data
	 */
	private sanitizeString(str: string): string {
		if (str.length > this.options.maxStringLength!) {
			throw new Error(`String length exceeds limit of ${this.options.maxStringLength} characters`);
		}

		// Remove potentially dangerous characters
		return str
			.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
			.replace(/javascript:/gi, '') // Remove javascript: protocol
			.replace(/data:/gi, '') // Remove data: protocol
			.replace(/vbscript:/gi, '') // Remove vbscript: protocol
			.trim();
	}

	/**
	 * Sanitizes number data
	 */
	private sanitizeNumber(num: number): number {
		if (!isFinite(num)) {
			throw new Error('Number must be finite');
		}
		
		// Check for reasonable range
		if (Math.abs(num) > Number.MAX_SAFE_INTEGER) {
			throw new Error('Number exceeds safe integer range');
		}

		return num;
	}

	/**
	 * Sanitizes array data
	 */
	private sanitizeArray(arr: any[], depth: number): any[] {
		if (arr.length > this.options.maxArrayLength!) {
			throw new Error(`Array length exceeds limit of ${this.options.maxArrayLength} elements`);
		}

		return arr.map(item => this.sanitizeData(item, depth + 1));
	}

	/**
	 * Sanitizes object data
	 */
	private sanitizeObject(obj: any, depth: number): any {
		const sanitized: any = {};

		for (const [key, value] of Object.entries(obj)) {
			// Check for dangerous keys
			if (this.options.disallowedKeys!.includes(key)) {
				throw new Error(`Disallowed key: ${key}`);
			}

			// Sanitize key
			const sanitizedKey = this.sanitizeString(key);
			
			// Sanitize value
			sanitized[sanitizedKey] = this.sanitizeData(value, depth + 1);
		}

		return sanitized;
	}

	/**
	 * Performs additional security checks
	 */
	private performSecurityChecks(data: any): ValidationResult {
		const dataStr = JSON.stringify(data);

		// Check for potential injection patterns
		const dangerousPatterns = [
			/\<script\>/gi,
			/\<\/script\>/gi,
			/javascript:/gi,
			/on\w+\s*=/gi,
			/eval\s*\(/gi,
			/function\s*\(/gi,
			/\$\{.*\}/gi, // Template literals
			/\$\(.*\)/gi, // jQuery selectors
		];

		for (const pattern of dangerousPatterns) {
			if (pattern.test(dataStr)) {
				return {
					valid: false,
					error: 'Data contains potentially dangerous content'
				};
			}
		}

		return { valid: true };
	}
}

// Default validator instance
export const defaultDataValidator = new DataValidator();

// Validator specifically for sheet data
export const sheetDataValidator = new DataValidator({
	maxStringLength: 50000, // Allow longer strings for sheet data
	maxArrayLength: 10000,
	maxObjectDepth: 5,
	maxTotalSize: 5 * 1024 * 1024 // 5MB for sheet data
});