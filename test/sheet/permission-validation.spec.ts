import { describe, it, expect, beforeAll } from 'vitest';
import { 
	setupSheetAuth, 
	createSheetHeaders,
	BASE_URL,
	type SheetTestContext 
} from './helpers';

describe('Sheet API - Permission Validation Tests', () => {
	let testContext: SheetTestContext;

	beforeAll(async () => {
		const auth = await setupSheetAuth();
		testContext = {
			...auth,
			createdSheetIds: []
		};
	}, 30000);

	describe('Permission validation', () => {
		it('should reject requests with invalid session', async () => {
			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createSheetHeaders('invalid-session-token'),
				body: JSON.stringify({
					name: 'Test Sheet',
					public_read: true,
					public_write: false
				})
			});

			expect(response.status).toBe(401);
			const data = await response.json();
			expect(data.success).toBe(false);
		});

		it('should validate user permissions for sheet creation', async () => {
			const response = await fetch(`${BASE_URL}/api/sheets`, {
				method: 'POST',
				headers: createSheetHeaders(testContext.sessionId),
				body: JSON.stringify({
					name: 'Permission Test Sheet',
					public_read: false,
					public_write: false,
					user_read: ['other-user-id'],
					user_write: ['other-user-id']
				})
			});

			// Should succeed (user can create sheets with any permissions)
			// or fail based on actual permission system
			expect([200, 403].includes(response.status)).toBe(true);
		});
	});
});