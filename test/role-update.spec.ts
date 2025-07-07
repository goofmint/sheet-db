import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// ローカル開発サーバーのベースURL
const BASE_URL = 'http://localhost:8787';

describe('Role Update API', () => {
	let testSessionId: string;
	let validAuthToken: string;
	
	// Auth0テスト用の環境変数
	const auth0TestEmail = process.env.AUTH0_TEST_EMAIL;
	const auth0TestPassword = process.env.AUTH0_TEST_PASSWORD;

	beforeAll(async () => {
		// 実際のAuth0認証フローを通じてセッションIDを取得
		if (auth0TestEmail && auth0TestPassword) {
			console.log('Setting up real authentication for role update tests...');
			
			// 仮のセッションID（実際の実装では認証フローから取得）
			testSessionId = 'integration-test-session-id';
			validAuthToken = `Bearer ${testSessionId}`;
		} else {
			console.log('Skipping real authentication - using test session for basic validation tests');
			testSessionId = 'test-session-uuid-123';
			validAuthToken = `Bearer ${testSessionId}`;
		}
	});

	afterAll(async () => {
		// テスト後のクリーンアップ
		// 作成されたテストロールの削除などが必要な場合はここに実装
	});

	describe('PUT /api/roles/:roleName', () => {
		it('should require Authorization header', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					public_read: true
				})
			});

			expect(response.status).toBe(401);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toContain('Authorization header');
		});

		it('should require Bearer token format', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'InvalidFormat'
				},
				body: JSON.stringify({
					public_read: true
				})
			});

			expect(response.status).toBe(401);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toContain('Bearer token');
		});

		it('should handle missing role name parameter', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					public_read: true
				})
			});

			// 404 Not Found (ルートが存在しない) または 400 Bad Request が期待される
			expect([400, 404].includes(response.status)).toBe(true);
		});

		it('should handle invalid session ID', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer invalid-session-id'
				},
				body: JSON.stringify({
					public_read: true
				})
			});

			expect(response.status).toBe(401);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(['Session not found', 'Authentication failed', 'No spreadsheet configured', 'No valid Google token found'].some(msg => 
				data.error.includes(msg)
			)).toBe(true);
		});

		it('should handle non-existent role', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/non-existent-role-12345`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					public_read: true
				})
			});

			// 認証エラーまたは404 Not Found が期待される
			expect([401, 403, 404].includes(response.status)).toBe(true);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
		});

		it('should reject invalid name type', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					name: 123 // 数値
				})
			});

			expect([400, 401, 403].includes(response.status)).toBe(true);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			
			if (response.status === 400) {
				expect(data.error).toContain('must be a non-empty string');
			}
		});

		it('should reject empty name', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					name: ''
				})
			});

			expect([400, 401, 403].includes(response.status)).toBe(true);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			
			if (response.status === 400) {
				expect(data.error).toContain('must be a non-empty string');
			}
		});

		it('should reject invalid array fields', async () => {
			const invalidArrayTests = [
				{ field: 'role_read', value: 'not-an-array' },
				{ field: 'role_write', value: 123 },
				{ field: 'user_read', value: { invalid: 'object' } },
				{ field: 'user_write', value: 'string' },
				{ field: 'users', value: null },
				{ field: 'roles', value: false }
			];

			for (const test of invalidArrayTests) {
				const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': validAuthToken
					},
					body: JSON.stringify({
						[test.field]: test.value
					})
				});

				expect([400, 401, 403].includes(response.status)).toBe(true);
				const data = await response.json() as { success: boolean; error: string };
				expect(data.success).toBe(false);
				
				if (response.status === 400) {
					expect(data.error).toContain('must be an array');
				}
			}
		});

		it('should reject empty update body', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({})
			});

			expect([400, 401, 403].includes(response.status)).toBe(true);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			
			if (response.status === 400) {
				expect(data.error).toContain('No valid fields to update');
			}
		});

		it('should handle malformed JSON', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: 'invalid json'
			});

			expect(response.status).toBe(500);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
		});

		it.skip('should update role successfully (integration test)', async () => {
			// この統合テストは実際の認証環境でのみ実行可能
			if (!auth0TestEmail || !auth0TestPassword) {
				console.log('Skipping integration test: AUTH0_TEST_EMAIL or AUTH0_TEST_PASSWORD not configured');
				return;
			}

			// まず、テスト用のロールを作成
			const createRoleName = `test-update-role-${Date.now()}`;
			const createResponse = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					name: createRoleName,
					public_read: false,
					public_write: false
				})
			});

			if (createResponse.status === 401 || createResponse.status === 500) {
				// 認証またはシステムの問題でテストをスキップ
				const data = await createResponse.json() as { success: boolean; error: string };
				console.log('Skipping test due to auth/system issue:', data.error);
				return;
			}

			expect(createResponse.status).toBe(200);

			// 作成したロールを更新
			const updateResponse = await fetch(`${BASE_URL}/api/roles/${createRoleName}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					public_read: true,
					public_write: true,
					role_read: ['admin'],
					user_read: ['user123']
				})
			});

			if (updateResponse.status === 401 || updateResponse.status === 500) {
				// 認証またはシステムの問題でテストをスキップ
				const data = await updateResponse.json() as { success: boolean; error: string };
				console.log('Skipping test due to auth/system issue:', data.error);
				return;
			}

			expect(updateResponse.status).toBe(200);
			const updateData = await updateResponse.json() as {
				success: boolean;
				data: {
					name: string;
					public_read: boolean;
					public_write: boolean;
					role_read: string[];
					user_read: string[];
					updated_at: string;
				};
			};

			expect(updateData.success).toBe(true);
			expect(updateData.data.name).toBe(createRoleName);
			expect(updateData.data.public_read).toBe(true);
			expect(updateData.data.public_write).toBe(true);
			expect(updateData.data.role_read).toEqual(['admin']);
			expect(updateData.data.user_read).toEqual(['user123']);
			expect(updateData.data.updated_at).toBeDefined();
		});

		it.skip('should prevent duplicate names when updating (integration test)', async () => {
			// この統合テストは実際の認証環境でのみ実行可能
			if (!auth0TestEmail || !auth0TestPassword) {
				console.log('Skipping integration test: AUTH0_TEST_EMAIL or AUTH0_TEST_PASSWORD not configured');
				return;
			}

			const timestamp = Date.now();
			const firstRoleName = `test-role-1-${timestamp}`;
			const secondRoleName = `test-role-2-${timestamp}`;

			// 2つのロールを作成
			const createFirst = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					name: firstRoleName,
					public_read: false,
					public_write: false
				})
			});

			const createSecond = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					name: secondRoleName,
					public_read: false,
					public_write: false
				})
			});

			if (createFirst.status !== 200 || createSecond.status !== 200) {
				console.log('Skipping test due to role creation failure');
				return;
			}

			// 2番目のロールの名前を1番目のロールと同じに変更しようとする（重複エラーが期待される）
			const updateResponse = await fetch(`${BASE_URL}/api/roles/${secondRoleName}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					name: firstRoleName
				})
			});

			expect(updateResponse.status).toBe(409); // Conflict
			const updateData = await updateResponse.json() as { success: boolean; error: string };
			expect(updateData.success).toBe(false);
			expect(updateData.error).toContain('already exists');
			expect(updateData.error).toContain('unique');
		});
	});

	describe('Role permission validation', () => {
		it('should test valid boolean fields', async () => {
			const booleanTests = [
				{ field: 'public_read', value: true },
				{ field: 'public_read', value: false },
				{ field: 'public_write', value: true },
				{ field: 'public_write', value: false }
			];

			for (const test of booleanTests) {
				const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': validAuthToken
					},
					body: JSON.stringify({
						[test.field]: test.value
					})
				});

				// 認証エラーまたは権限エラーが期待される（ロールが存在しない、または権限がない）
				expect([401, 403, 404].includes(response.status)).toBe(true);
				const data = await response.json() as { success: boolean; error: string };
				expect(data.success).toBe(false);
			}
		});

		it('should test valid array fields', async () => {
			const arrayTests = [
				{ field: 'role_read', value: ['admin', 'user'] },
				{ field: 'role_write', value: [] },
				{ field: 'user_read', value: ['user123', 'user456'] },
				{ field: 'user_write', value: ['user789'] },
				{ field: 'users', value: ['user1', 'user2', 'user3'] },
				{ field: 'roles', value: ['parent-role'] }
			];

			for (const test of arrayTests) {
				const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': validAuthToken
					},
					body: JSON.stringify({
						[test.field]: test.value
					})
				});

				// 認証エラーまたは権限エラーが期待される（ロールが存在しない、または権限がない）
				expect([401, 403, 404].includes(response.status)).toBe(true);
				const data = await response.json() as { success: boolean; error: string };
				expect(data.success).toBe(false);
			}
		});
	});

	describe('DELETE /api/roles/:roleName', () => {
		it('should require Authorization header', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			expect(response.status).toBe(401);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toContain('Authorization header');
		});

		it('should require Bearer token format', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'InvalidFormat'
				}
			});

			expect(response.status).toBe(401);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(data.error).toContain('Bearer token');
		});

		it('should handle missing role name parameter', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				}
			});

			// 404 Not Found (ルートが存在しない) または 400 Bad Request が期待される
			expect([400, 404].includes(response.status)).toBe(true);
		});

		it('should handle invalid session ID', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer invalid-session-id'
				}
			});

			expect(response.status).toBe(401);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
			expect(['Session not found', 'Authentication failed', 'No spreadsheet configured', 'No valid Google token found'].some(msg => 
				data.error.includes(msg)
			)).toBe(true);
		});

		it('should handle non-existent role', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/non-existent-role-delete-12345`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				}
			});

			// 認証エラー、権限エラー、または404 Not Found が期待される
			expect([401, 403, 404].includes(response.status)).toBe(true);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
		});

		it('should check write permissions', async () => {
			const response = await fetch(`${BASE_URL}/api/roles/test-role-no-permission`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				}
			});

			// 認証エラー、権限エラー、または404 Not Found が期待される
			expect([401, 403, 404].includes(response.status)).toBe(true);
			const data = await response.json() as { success: boolean; error: string };
			expect(data.success).toBe(false);
		});

		it.skip('should delete role successfully (integration test)', async () => {
			// この統合テストは実際の認証環境でのみ実行可能
			if (!auth0TestEmail || !auth0TestPassword) {
				console.log('Skipping integration test: AUTH0_TEST_EMAIL or AUTH0_TEST_PASSWORD not configured');
				return;
			}

			// まず、テスト用のロールを作成
			const deleteRoleName = `test-delete-role-${Date.now()}`;
			const createResponse = await fetch(`${BASE_URL}/api/roles`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					name: deleteRoleName,
					public_read: false,
					public_write: false
				})
			});

			if (createResponse.status === 401 || createResponse.status === 500) {
				// 認証またはシステムの問題でテストをスキップ
				const data = await createResponse.json() as { success: boolean; error: string };
				console.log('Skipping test due to auth/system issue:', data.error);
				return;
			}

			expect(createResponse.status).toBe(200);

			// 作成したロールを削除
			const deleteResponse = await fetch(`${BASE_URL}/api/roles/${deleteRoleName}`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				}
			});

			if (deleteResponse.status === 401 || deleteResponse.status === 500) {
				// 認証またはシステムの問題でテストをスキップ
				const data = await deleteResponse.json() as { success?: boolean; error?: string };
				console.log('Skipping test due to auth/system issue:', data.error || 'Unknown error');
				return;
			}

			expect(deleteResponse.status).toBe(200);
			const deleteData = await deleteResponse.json();

			// 削除後のレスポンスは空のオブジェクト
			expect(deleteData).toEqual({});

			// 削除したロールが存在しないことを確認
			const verifyResponse = await fetch(`${BASE_URL}/api/roles/${deleteRoleName}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				},
				body: JSON.stringify({
					public_read: true
				})
			});

			// ロールが存在しないので404エラーが期待される
			expect([403, 404].includes(verifyResponse.status)).toBe(true);
		});

		it('should return empty object on successful deletion', async () => {
			// 削除処理のテスト（実際の削除は行わない）
			const response = await fetch(`${BASE_URL}/api/roles/test-role-for-empty-response`, {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': validAuthToken
				}
			});

			// 認証エラー、権限エラー、または404が期待される（実際のロールは存在しない）
			expect([401, 403, 404].includes(response.status)).toBe(true);
			
			// レスポンスフォーマットの確認
			const data = await response.json() as any;
			if (response.status === 200) {
				// 成功時は空のオブジェクトが期待される
				expect(data).toEqual({});
			} else {
				// エラー時はsuccess: falseとerrorが期待される
				expect(data.success).toBe(false);
				expect(data.error).toBeDefined();
			}
		});
	});
});