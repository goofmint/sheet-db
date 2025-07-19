import { describe, it, expect } from 'vitest';
import { createTestSheetRequest, BASE_URL, type SheetCreateRequest, type SheetCreateResponse } from './helpers';

describe('Sheet API - Authentication Tests', () => {
	describe('Authentication requirements', () => {
		it('should return 401 for unauthenticated request', async () => {
			const createData = createTestSheetRequest({
				name: `TestSheet_Unauth_${Date.now()}`
			});

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Authorization': 'Bearer invalid_session_id',
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			expect(response.status).toBe(401);
			const data = await response.json() as SheetCreateResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});

		it('should return 401 for missing authorization header', async () => {
			const createData = createTestSheetRequest({
				name: `TestSheet_NoAuth_${Date.now()}`
			});

			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(createData)
			});

			// API might return 400 for missing auth header or 401 for authentication failure
			expect([400, 401].includes(response.status)).toBe(true);
			const data = await response.json() as SheetCreateResponse;
			expect(data.success).toBe(false);
			expect(data.error).toBeDefined();
		});
	});
});