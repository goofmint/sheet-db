import { env, SELF } from 'cloudflare:test';
import { validateAuth0Config, fetchAuth0Token, fetchAuth0UserInfo, BASE_URL } from '../helpers/auth';
import type { AuthCallbackResponse } from '../types/api-responses';

export { BASE_URL };

// Mock file data for testing
export const createTestFile = (name: string, size: number, type: string): File => {
	const buffer = new ArrayBuffer(size);
	const view = new Uint8Array(buffer);
	// Fill with test data
	for (let i = 0; i < size; i++) {
		view[i] = i % 256;
	}
	return new File([buffer], name, { type });
};

// Setup authentication for file upload tests
export const setupFileUploadAuth = async (): Promise<string | null> => {
	try {
		const config = validateAuth0Config();
		if (!config) {
			return 'mock-session-id-for-file-upload-testing';
		}

		// Get a real Auth0 token for authentication
		const accessToken = await fetchAuth0Token(config);
		if (!accessToken) {
			return 'mock-session-id-for-file-upload-testing';
		}

		// Get user info from Auth0
		const testUserInfo = await fetchAuth0UserInfo(config.auth0Domain, accessToken);
		if (!testUserInfo) {
			return 'mock-session-id-for-file-upload-testing';
		}

		// Login to get session ID
		const loginResponse = await fetch(`${BASE_URL}/api/login`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${accessToken}`
			},
			body: JSON.stringify({
				idToken: accessToken
			})
		});

		if (loginResponse.ok) {
			const loginData = await loginResponse.json() as AuthCallbackResponse;
			return loginData.data?.sessionId || 'mock-session-id-for-file-upload-testing';
		}

		return 'mock-session-id-for-file-upload-testing';
	} catch (error) {
		console.warn('Auth0 configuration not available for testing, using mock session');
		return 'mock-session-id-for-file-upload-testing';
	}
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