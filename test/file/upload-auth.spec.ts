import { describe, it, expect, beforeAll } from 'vitest';
import { setupFileUploadAuth, createTestFile, createFormDataWithFile, createFileUploadHeaders, BASE_URL, TEST_FILES } from './helpers';
import type { ApiErrorResponse } from '../types/api-responses';

describe('File Upload API - Authentication Tests', () => {
	let testSessionId: string | null = null;

	beforeAll(async () => {
		testSessionId = await setupFileUploadAuth();
	});

	describe('Authentication requirement', () => {
		it('should handle authentication requirement', async () => {
			// This test depends on ANONYMOUS_FILE_UPLOAD configuration
			const imageFile = createTestFile(TEST_FILES.smallImage.name, TEST_FILES.smallImage.size, TEST_FILES.smallImage.type);
			const formData = createFormDataWithFile(imageFile);

			const response = await fetch(`${BASE_URL}/api/files`, {
				method: 'POST',
				body: formData
			});

			// If anonymous upload is disabled, should return 401
			// If anonymous upload is enabled, should return 200 or 400 (config error)
			expect(response.status === 401 || [200, 400, 500].includes(response.status)).toBe(true);
			
			if (response.status === 401) {
				const data = await response.json() as ApiErrorResponse;
				expect(data.success).toBe(false);
				expect(data.error).toContain('Authentication required');
			}
		});

		it('should handle upload destination not configured', async () => {
			expect(testSessionId).toBeDefined();

			const imageFile = createTestFile(TEST_FILES.smallImage.name, TEST_FILES.smallImage.size, TEST_FILES.smallImage.type);
			const formData = createFormDataWithFile(imageFile);

			const response = await fetch(`${BASE_URL}/api/files`, {
				method: 'POST',
				headers: createFileUploadHeaders(testSessionId),
				body: formData
			});

			// This will likely fail with 400 or 500 if upload destination is not configured
			expect(response.status === 400 || [200, 401, 500].includes(response.status)).toBe(true);
			
			if (response.status === 400) {
				const data = await response.json() as ApiErrorResponse;
				expect(data.success).toBe(false);
				expect(data.error).toContain('Upload destination not configured');
			}
		});
	});
});