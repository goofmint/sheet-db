import { env, SELF } from 'cloudflare:test';
import { getSharedAuth } from '../setup/shared-auth';
import { BASE_URL } from '../helpers/auth';
import type { AuthCallbackResponse } from '../types/api-responses';

export { BASE_URL };

// Test file data creation
export const createTestFile = (name: string, size: number, type: string): File => {
	const buffer = new ArrayBuffer(size);
	const view = new Uint8Array(buffer);
	// Fill with test data
	for (let i = 0; i < size; i++) {
		view[i] = i % 256;
	}
	return new File([buffer], name, { type });
};

// Setup authentication for file upload tests using shared auth
export const setupFileUploadAuth = async (): Promise<string> => {
	console.log('Setting up shared authentication for file upload tests...');
	
	const auth = await getSharedAuth();
	console.log('✅ File upload tests using shared authentication');
	
	return auth.sessionId;
};

// Common test files
export const TEST_FILES = {
	smallImage: { name: 'test.jpg', size: 1024, type: 'image/jpeg' },
	largeImage: { name: 'large-file.jpg', size: 11 * 1024 * 1024, type: 'image/jpeg' },
	textFile: { name: 'test.txt', size: 1024, type: 'text/plain' },
	pngImage: { name: 'test.png', size: 1024, type: 'image/png' },
	gifImage: { name: 'test.gif', size: 1024, type: 'image/gif' },
	pdfFile: { name: 'test.pdf', size: 1024, type: 'application/pdf' },
	dangerousFile: { name: 'script.js', size: 1024, type: 'application/javascript' },
	pathTraversalFile: { name: '../../../etc/passwd', size: 1024, type: 'image/jpeg' }
};

// Create FormData with file
export const createFormDataWithFile = (file: File): FormData => {
	const formData = new FormData();
	formData.append('file', file);
	return formData;
};

// Create request headers with authentication
export const createFileUploadHeaders = (sessionId: string | null) => {
	const headers: Record<string, string> = {};
	if (sessionId) {
		headers['Authorization'] = `Bearer ${sessionId}`;
	}
	return headers;
};