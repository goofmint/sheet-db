import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { drizzle } from 'drizzle-orm/d1';
import { ConfigService } from '@/services/config';
import { Env } from '@/types/env';

const app = new Hono<{ Bindings: Env }>();

// Password authentication
app.post('/', async (c) => {
  try {
    // Initialize ConfigService
    const db = drizzle(c.env.DB);
    if (!ConfigService.isInitialized()) {
      await ConfigService.initialize(db);
    }

    // Try both formData and parseBody for better compatibility
    let password: string;
    try {
      const body = await c.req.parseBody();
      password = body.password as string;
    } catch {
      const formData = await c.req.formData();
      password = formData.get('password') as string;
    }

    if (!password) {
      return c.redirect('/config?error=password_required');
    }

    // Get configuration password
    const configPassword = ConfigService.getString('app.config_password');
    
    if (!configPassword) {
      return c.redirect('/config?error=config_not_found');
    }

    // Password verification (constant-time comparison)
    const isValid = await comparePasswords(password, configPassword);
    
    if (!isValid) {
      // Timing attack protection: wait for a fixed duration
      await new Promise(resolve => setTimeout(resolve, 100));
      return c.redirect('/config?error=invalid_password');
    }

    // Authentication successful: set cookie
    setCookie(c, 'config_auth', 'authenticated', {
      httpOnly: true,
      secure: new URL(c.req.url).protocol === 'https:',
      sameSite: 'Strict',
      maxAge: 60 * 60 * 2, // 2 hours
      path: '/'
    });

    return c.redirect('/config');

  } catch (error) {
    console.error('Config auth error:', error);
    return c.redirect('/config?error=server_error');
  }
});

// Constant-time password comparison
async function comparePasswords(input: string, stored: string): Promise<boolean> {
  // Simple string comparison (should ideally compare with hashed passwords)
  if (input.length !== stored.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < input.length; i++) {
    result |= input.charCodeAt(i) ^ stored.charCodeAt(i);
  }
  
  return result === 0;
}

export default app;