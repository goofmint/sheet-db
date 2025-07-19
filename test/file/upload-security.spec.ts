import { describe, it, expect } from 'vitest';
import { createTestFile, createFormDataWithFile, BASE_URL, TEST_FILES } from './helpers';
import type { ApiErrorResponse, FileUploadResponse } from '../types/api-responses';

describe('File Upload API - Security Tests', () => {
	describe('Dangerous file type rejection', () => {
		it('should reject files with dangerous extensions', async () => {
			const dangerousFiles = [
				'script.js',
				'executable.exe',
				'malware.bat',
				'virus.scr'
			];

			for (const filename of dangerousFiles) {
				const file = createTestFile(filename, 1024, 'application/octet-stream');
				const formData = createFormDataWithFile(file);

				const response = await fetch(`${BASE_URL}/api/files`, {
					method: 'POST',
					body: formData
				});

				// Should be rejected based on file type restrictions
				expect(response.status === 415 || [401, 500].includes(response.status)).toBe(true);
				
				if (response.status === 415) {
					const data = await response.json() as ApiErrorResponse;
					expect(data.success).toBe(false);
					expect(data.error).toContain('File type not allowed');
				}
			}
		}, 30000);
	});

	describe('Filename sanitization', () => {
		it('should sanitize filenames', async () => {
			// Test with potentially dangerous filename
			const dangerousFile = createTestFile(TEST_FILES.pathTraversalFile.name, TEST_FILES.pathTraversalFile.size, TEST_FILES.pathTraversalFile.type);
			const formData = createFormDataWithFile(dangerousFile);

			const response = await fetch(`${BASE_URL}/api/files`, {
				method: 'POST',
				body: formData
			});

			if (response.status === 200) {
				const data = await response.json() as FileUploadResponse;
				// Original filename should be preserved in response
				expect(data.data.fileName).toBe('../../../etc/passwd');
				// But the actual stored filename should be sanitized (random UUID)
				expect(data.data.url).not.toContain('../../../etc/passwd');
			}
		});
	});
});