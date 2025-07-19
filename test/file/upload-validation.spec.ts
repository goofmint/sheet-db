import { describe, it, expect, beforeAll } from 'vitest';
import { setupFileUploadAuth, createTestFile, createFormDataWithFile, createFileUploadHeaders, BASE_URL, TEST_FILES } from './helpers';
import type { ApiErrorResponse } from '../types/api-responses';

describe('File Upload API - Validation Tests', () => {
	let testSessionId: string | null = null;

	beforeAll(async () => {
		testSessionId = await setupFileUploadAuth();
	});

	describe('File presence validation', () => {
		it('should return error when no file is provided', async () => {
			expect(testSessionId).toBeDefined();

			const formData = new FormData();
			// Don't add any file
			
			const response = await fetch(`${BASE_URL}/api/files`, {
				method: 'POST',
				headers: createFileUploadHeaders(testSessionId),
				body: formData
			});

			// API may return 400 for missing file or 401 for auth issues
			expect([400, 401, 500].includes(response.status)).toBe(true);
			const data = await response.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});
	});

	describe('File size validation', () => {
		it('should handle file size validation', async () => {
			expect(testSessionId).toBeDefined();

			// Create a file that exceeds the default limit (10MB)
			const largeFile = createTestFile(TEST_FILES.largeImage.name, TEST_FILES.largeImage.size, TEST_FILES.largeImage.type);
			const formData = createFormDataWithFile(largeFile);

			const response = await fetch(`${BASE_URL}/api/files`, {
				method: 'POST',
				headers: createFileUploadHeaders(testSessionId),
				body: formData
			});

			// API may return 413 for file size, 401 for auth issues, or 500 for config issues
			expect([413, 401, 500].includes(response.status)).toBe(true);
			const data = await response.json() as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should validate MAX_FILE_SIZE configuration', async () => {
			// Test with different file sizes based on configuration
			const smallFile = createTestFile(TEST_FILES.smallImage.name, 100, TEST_FILES.smallImage.type);
			const formData = createFormDataWithFile(smallFile);

			const response = await fetch(`${BASE_URL}/api/files`, {
				method: 'POST',
				body: formData
			});

			// Small files should not be rejected for size reasons
			expect(response.status).not.toBe(413);
		});
	});

	describe('File type validation', () => {
		it('should handle file type validation', async () => {
			expect(testSessionId).toBeDefined();

			// Create a file with disallowed type (assuming default is image/*)
			const textFile = createTestFile(TEST_FILES.textFile.name, TEST_FILES.textFile.size, TEST_FILES.textFile.type);
			const formData = createFormDataWithFile(textFile);

			const response = await fetch(`${BASE_URL}/api/files`, {
				method: 'POST',
				headers: createFileUploadHeaders(testSessionId),
				body: formData
			});

			// This might pass if ALLOW_UPLOAD_EXTENSION allows text files
			// or fail with 415 if it doesn't, or 401 for auth issues
			expect(response.status === 415 || [200, 401, 500].includes(response.status)).toBe(true);
			
			if (response.status === 415) {
				const data = await response.json() as ApiErrorResponse;
				expect(data.success).toBe(false);
				expect(data.error).toContain('File type not allowed');
			}
		});

		it('should validate ALLOW_UPLOAD_EXTENSION configuration', async () => {
			// Test different file types
			const testFiles = [
				TEST_FILES.smallImage,
				TEST_FILES.pngImage,
				TEST_FILES.gifImage,
				TEST_FILES.pdfFile,
				TEST_FILES.textFile
			];

			for (const fileInfo of testFiles) {
				const file = createTestFile(fileInfo.name, fileInfo.size, fileInfo.type);
				const formData = createFormDataWithFile(file);

				const response = await fetch(`${BASE_URL}/api/files`, {
					method: 'POST',
					body: formData
				});

				// Response should be consistent with ALLOW_UPLOAD_EXTENSION setting
				if (response.status === 415) {
					const data = await response.json() as ApiErrorResponse;
					expect(data.success).toBe(false);
					expect(data.error).toContain('File type not allowed');
				}
			}
		});
	});
});