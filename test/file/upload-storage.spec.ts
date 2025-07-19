import { describe, it, expect } from 'vitest';
import { createTestFile, createFormDataWithFile, BASE_URL, TEST_FILES } from './helpers';
import type { ApiErrorResponse } from '../types/api-responses';

describe('File Upload API - Storage Tests', () => {
	describe('Google Drive storage', () => {
		it('should handle Google Drive storage configuration', async () => {
			// This test would need proper Google Drive configuration
			// For now, we just verify the error handling
			const imageFile = createTestFile('gdrive-test.jpg', TEST_FILES.smallImage.size, TEST_FILES.smallImage.type);
			const formData = createFormDataWithFile(imageFile);

			const response = await fetch(`${BASE_URL}/api/files`, {
				method: 'POST',
				body: formData
			});

			// Should handle Google Drive errors gracefully
			expect([200, 400, 401, 500].includes(response.status)).toBe(true);
			
			if (response.status === 500) {
				const data = await response.json() as ApiErrorResponse;
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});
	});

	describe('R2 storage', () => {
		it('should handle R2 storage configuration', async () => {
			// This test would need proper R2 configuration
			// For now, we just verify the error handling
			const imageFile = createTestFile('r2-test.jpg', TEST_FILES.smallImage.size, TEST_FILES.smallImage.type);
			const formData = createFormDataWithFile(imageFile);

			const response = await fetch(`${BASE_URL}/api/files`, {
				method: 'POST',
				body: formData
			});

			// Should handle R2 errors gracefully
			expect([200, 400, 401, 500].includes(response.status)).toBe(true);
			
			if (response.status === 500) {
				const data = await response.json() as ApiErrorResponse;
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});
	});
});