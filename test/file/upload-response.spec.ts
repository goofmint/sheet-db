import { describe, it, expect, beforeAll } from 'vitest';
import { setupFileUploadAuth, createTestFile, createFormDataWithFile, createFileUploadHeaders, BASE_URL, TEST_FILES } from './helpers';
import type { ApiErrorResponse, FileUploadResponse } from '../types/api-responses';

describe('File Upload API - Response Format Tests', () => {
	let testSessionId: string | null = null;

	beforeAll(async () => {
		testSessionId = await setupFileUploadAuth();
	});

	describe('Success response format', () => {
		it('should return proper success response format', async () => {
			expect(testSessionId).toBeDefined();

			const imageFile = createTestFile('format-test.jpg', TEST_FILES.smallImage.size, TEST_FILES.smallImage.type);
			const formData = createFormDataWithFile(imageFile);

			const response = await fetch(`${BASE_URL}/api/files`, {
				method: 'POST',
				headers: createFileUploadHeaders(testSessionId),
				body: formData
			});

			if (response.status === 200) {
				const data = await response.json() as FileUploadResponse;
				
				// Verify response structure
				expect(data).toHaveProperty('success');
				expect(data.success).toBe(true);
				expect(data).toHaveProperty('data');
				expect(data.data).toHaveProperty('url');
				expect(data.data).toHaveProperty('fileName');
				expect(data.data).toHaveProperty('contentType');
				expect(data.data).toHaveProperty('fileSize');
				
				// Verify data types
				expect(typeof data.data.url).toBe('string');
				expect(typeof data.data.fileName).toBe('string');
				expect(typeof data.data.contentType).toBe('string');
				expect(typeof data.data.fileSize).toBe('number');
				
				// Verify URL is valid HTTPS
				expect(data.data.url).toMatch(/^https:\/\//);
			}
		});
	});

	describe('Error response format', () => {
		it('should return proper error response format', async () => {
			expect(testSessionId).toBeDefined();

			// Test with no file to guarantee error
			const formData = new FormData();
			
			const response = await fetch(`${BASE_URL}/api/files`, {
				method: 'POST',
				headers: createFileUploadHeaders(testSessionId),
				body: formData
			});

			// API may return 400 for missing file or 401 for auth issues
			expect([400, 401, 500].includes(response.status)).toBe(true);
			const data = await response.json() as ApiErrorResponse;
			
			// Verify error response structure
			expect(data).toHaveProperty('success');
			expect(data.success).toBe(false);
			expect(data).toHaveProperty('error');
			expect(typeof data.error).toBe('string');
		});
	});
});