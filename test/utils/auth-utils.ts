import { SessionRepository } from '@/repositories/session';

export interface TestSession {
  session_id: string;
  user_id: string;
  expires_at: string;
}

/**
 * Create a test session for authentication testing
 */
export async function createTestSession(sessionRepo: SessionRepository): Promise<TestSession> {
  const sessionId = `test-session-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  const userId = 'test-user-123';
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now
  
  const userData = JSON.stringify({
    sub: userId,
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.png'
  });

  await sessionRepo.create({
    session_id: sessionId,
    user_id: userId,
    user_data: userData,
    expires_at: expiresAt,
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token'
  });

  return {
    session_id: sessionId,
    user_id: userId,
    expires_at: expiresAt
  };
}