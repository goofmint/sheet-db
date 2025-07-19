import { describe, it, expect } from 'vitest';
import { setupRoleTests, createJsonHeaders, testSessionId, BASE_URL } from './helpers.js';
import type { ApiErrorResponse } from '../types/api-responses';

describe('Role Authentication API', () => {
	setupRoleTests();

	describe('Authentication tests', () => {
		it('should require Authorization header for create', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'test-role-no-auth' }),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should require Bearer token format for create', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: 'InvalidFormat' },
				body: JSON.stringify({ name: 'test-role-invalid-auth' }),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should require Authorization header for delete', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should require Bearer token format for delete', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json', Authorization: 'InvalidFormat' },
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should require Authorization header for update', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ public_read: true }),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should require Bearer token format for update', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json', Authorization: 'InvalidFormat' },
				body: JSON.stringify({ public_read: true }),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});
		it('should handle missing session ID', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' },
				body: JSON.stringify({ name: 'test-role-empty-session' }),
			});

			expect(response.status).toBe(400);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});


		it('should handle invalid session ID for create', async () => {
			const response = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: createJsonHeaders('invalid-session-id'),
				body: JSON.stringify({ name: 'test-role-invalid-session' }),
			});

			expect(response.status).toBe(401);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			expect(['Session not found', 'Authentication failed', 'No spreadsheet configured', 'No valid Google token found'].some((msg) => data.error.includes(msg))).toBe(true);
		});


		it('should handle invalid session ID for delete', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'DELETE',
				headers: createJsonHeaders('invalid-session-id'),
			});

			expect(response.status).toBe(401);
			const data = (await response.json()) as ApiErrorResponse;
			expect(data.success).toBe(false);
			const expectedMessages = ['Session not found', 'Authentication failed', 'No spreadsheet configured', 'No valid Google token found', 'Failed to fetch session data'];
			expect(expectedMessages.some((msg) => data.error.includes(msg))).toBe(true);
		});

	});
});