/**
 * Step 1: Google OAuth2 Credentials Input Component
 *
 * Handles Google OAuth2 credentials configuration
 */

import type { FC } from 'hono/jsx/dom';
import { useEffect, useCallback } from 'hono/jsx/dom';
import { styles } from '../Setup.css';

/**
 * Step 1: Google OAuth2 Credentials Input
 */
export const Step1GoogleCredentials: FC = () => {
  useEffect(() => {
    console.log('Step1GoogleCredentials mounted');
    const redirectUriInput = document.getElementById('redirectUri') as HTMLInputElement;
    if (redirectUriInput && !redirectUriInput.value) {
      redirectUriInput.value = window.location.origin + '/api/setup/google-callback';
    }
  }, []);

  const handleClearTokens = useCallback(async () => {
    if (!confirm('This will clear all stored Google tokens. You will need to re-authenticate. Continue?')) {
      return;
    }

    try {
      const res = await fetch('/api/setup/google-tokens', { method: 'DELETE' });
      if (res.ok) {
        alert('Tokens cleared successfully. Please re-authenticate.');
        window.location.reload();
      } else {
        const error = await res.json() as { error?: string };
        alert('Failed to clear tokens: ' + (error.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Error: ' + ((error as Error)?.message || 'Unknown error'));
    }
  }, []);

  const handleSubmit = useCallback(async (e: Event) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const credentials = {
      clientId: formData.get('clientId'),
      clientSecret: formData.get('clientSecret'),
      redirectUri: formData.get('redirectUri')
    };

    try {
      const saveRes = await fetch('/api/setup/google-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });

      if (!saveRes.ok) {
        const error = await saveRes.json() as { error?: string };
        alert('Failed to save credentials: ' + (error.error || 'Unknown error'));
        return;
      }

      const authRes = await fetch('/api/setup/google-auth');
      if (!authRes.ok) {
        const error = await authRes.json() as { error?: string };
        alert('Failed to initiate OAuth: ' + (error.error || 'Unknown error'));
        return;
      }

      const data = await authRes.json() as { authUrl: string };
      window.location.href = data.authUrl;
    } catch (error) {
      alert('Error: ' + ((error as Error)?.message || 'Unknown error'));
    }
  }, []);

  return (
    <div
      style={styles.card}
    >
      <h2 style={styles.cardTitle}>
        Google OAuth2 Credentials
      </h2>
      <p style={styles.cardDescription}>
        Enter your Google Cloud Console OAuth 2.0 credentials. If you don&apos;t have them yet,{' '}
        <a
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.link}
        >
          create them here
        </a>
        .
      </p>

      <div style={styles.noteBox}>
        <div style={styles.noteText}>
          <strong>Note:</strong> If you changed OAuth scopes, clear existing tokens first
        </div>
        <button
          type="button"
          onClick={handleClearTokens}
          style={styles.buttonDanger}
        >
          Clear Tokens
        </button>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div>
          <label
            htmlFor="clientId"
            style={styles.inputLabel}
          >
            Client ID
          </label>
          <input
            type="text"
            id="clientId"
            name="clientId"
            required
            placeholder="123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com"
            style={styles.input}
          />
        </div>

        <div>
          <label
            htmlFor="clientSecret"
            style={styles.inputLabel}
          >
            Client Secret
          </label>
          <input
            type="password"
            id="clientSecret"
            name="clientSecret"
            required
            placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
            style={styles.input}
          />
        </div>

        <div>
          <label
            htmlFor="redirectUri"
            style={styles.inputLabel}
          >
            Redirect URI
          </label>
          <input
            type="url"
            id="redirectUri"
            name="redirectUri"
            required
            readOnly
            placeholder="/api/setup/google-callback"
            style={styles.inputReadOnly}
          />
          <p style={styles.inputHelp}>
            Add this URI to your Google Cloud Console OAuth2 credentials
          </p>
        </div>

        <button
          type="submit"
          style={styles.buttonPrimary}
        >
          Save Credentials & Connect to Google
        </button>
      </form>
    </div>
  );
};
