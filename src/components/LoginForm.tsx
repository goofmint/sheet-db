/**
 * Login Form Component (Client-side)
 * Handles user authentication with React
 */

import { useState } from 'hono/jsx';

interface LoginFormProps {
  error?: string;
}

export function LoginForm({ error: initialError }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(undefined);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        // Redirect to intended page or settings
        const redirectParam = new URLSearchParams(window.location.search).get(
          'redirect'
        );
        const redirectTo =
          redirectParam &&
          redirectParam.startsWith('/') &&
          !redirectParam.startsWith('//')
            ? redirectParam
            : '/settings';
        window.location.href = redirectTo;
      } else {
        const data = (await response.json()) as { message?: string };
        setError(data.message || 'Invalid username or password');
      }
    } catch (err) {
      console.error('Login failed:', err);
      setError('Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getErrorMessage = (errorCode?: string) => {
    switch (errorCode) {
      case 'invalid':
        return 'Invalid username or password';
      case 'unauthorized':
        return 'Authentication required';
      case 'forbidden':
        return 'Administrator role required for this operation';
      default:
        return errorCode;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '80vh',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '40px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb',
          width: '100%',
          maxWidth: '400px',
        }}
      >
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 'bold',
            margin: '0 0 8px 0',
            textAlign: 'center',
          }}
        >
          Sign In
        </h1>
        <p
          style={{
            color: '#6b7280',
            margin: '0 0 32px 0',
            textAlign: 'center',
          }}
        >
          Enter your credentials to access the system
        </p>

        {error && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '24px',
              color: '#991b1b',
            }}
          >
            {getErrorMessage(error)}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="username"
              style={{
                display: 'block',
                fontWeight: '500',
                marginBottom: '6px',
                fontSize: '14px',
              }}
            >
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              required
              autoComplete="username"
              value={username}
              onInput={(e) =>
                setUsername((e.target as HTMLInputElement).value)
              }
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontWeight: '500',
                marginBottom: '6px',
                fontSize: '14px',
              }}
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              autoComplete="current-password"
              value={password}
              onInput={(e) =>
                setPassword((e.target as HTMLInputElement).value)
              }
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: '100%',
              backgroundColor: isSubmitting ? '#9ca3af' : '#3b82f6',
              color: 'white',
              padding: '12px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: '600',
              fontSize: '16px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
