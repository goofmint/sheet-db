/**
 * Setup Wizard Component
 *
 * Multi-step setup wizard for initial configuration:
 * Step 1: Google OAuth2 credentials input
 * Step 2: Sheet selection (after OAuth callback)
 * Step 2.5: Sheet initialization with progress indicator
 * Step 3: File storage and admin user configuration
 */

import type { FC } from 'hono/jsx';
import { raw } from 'hono/html';

interface SetupProps {
  step: number;
  error?: string;
  sheets?: Array<{ id: string; name: string; url: string }>;
  initProgress?: {
    users: boolean;
    roles: boolean;
    files: boolean;
  };
}

/**
 * Setup Wizard Component
 *
 * Renders different steps based on the `step` prop
 */
export const Setup: FC<SetupProps> = ({ step, error, sheets, initProgress }) => {
  return (
    <div>
      <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
        Initial Setup
      </h1>
      <p style={{ color: '#6b7280', margin: '0 0 32px 0' }}>
        Connect to Google Sheets and configure your backend
      </p>

      {/* Progress indicator */}
      <div style={{ marginBottom: '32px', display: 'flex', gap: '8px' }}>
        <StepIndicator number={1} active={step === 1} completed={step > 1} label="Credentials" />
        <StepIndicator number={2} active={step === 2} completed={step > 2} label="Sheet Selection" />
        <StepIndicator number={3} active={step === 3} completed={step > 3} label="Configuration" />
      </div>

      {/* Error display */}
      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #ef4444',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '24px',
          }}
        >
          <p style={{ margin: 0, color: '#991b1b', fontSize: '14px' }}>
            ❌ <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Step content */}
      {step === 1 && <Step1GoogleCredentials />}
      {step === 2 && <Step2SheetSelection sheets={sheets} />}
      {step === 2.5 && <Step25SheetInitialization progress={initProgress} />}
      {step === 3 && <Step3FinalConfiguration />}
    </div>
  );
};

/**
 * Step indicator component
 */
const StepIndicator: FC<{
  number: number;
  active: boolean;
  completed: boolean;
  label: string;
}> = ({ number, active, completed, label }) => {
  const bgColor = completed ? '#10b981' : active ? '#3b82f6' : '#e5e7eb';
  const textColor = completed || active ? '#ffffff' : '#9ca3af';

  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: bgColor,
          color: textColor,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          marginBottom: '8px',
        }}
      >
        {completed ? '✓' : number}
      </div>
      <div style={{ fontSize: '12px', color: active ? '#1f2937' : '#9ca3af' }}>{label}</div>
    </div>
  );
};

/**
 * Step 1: Google OAuth2 Credentials Input
 */
const Step1GoogleCredentials: FC = () => {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb',
      }}
    >
      <h2 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 16px 0' }}>
        Google OAuth2 Credentials
      </h2>
      <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px 0' }}>
        Enter your Google Cloud Console OAuth 2.0 credentials. If you don&apos;t have them yet,{' '}
        <a
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#3b82f6', textDecoration: 'underline' }}
        >
          create them here
        </a>
        .
      </p>

      <form id="google-credentials-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <label
            htmlFor="clientId"
            style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}
          >
            Client ID
          </label>
          <input
            type="text"
            id="clientId"
            name="clientId"
            required
            placeholder="123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="clientSecret"
            style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}
          >
            Client Secret
          </label>
          <input
            type="password"
            id="clientSecret"
            name="clientSecret"
            required
            placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          />
        </div>

        <div>
          <label
            htmlFor="redirectUri"
            style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}
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
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: '#f9fafb',
            }}
          />
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
            Add this URI to your Google Cloud Console OAuth2 credentials
          </p>
        </div>

        <button
          type="submit"
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          Save Credentials & Connect to Google
        </button>
      </form>

      <script>
        {raw(`
          // Set redirect URI dynamically
          document.addEventListener('DOMContentLoaded', () => {
            const redirectUriInput = document.getElementById('redirectUri');
            if (redirectUriInput && !redirectUriInput.value) {
              redirectUriInput.value = window.location.origin + '/api/setup/google-callback';
            }
          });

          document.getElementById('google-credentials-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const credentials = {
              clientId: formData.get('clientId'),
              clientSecret: formData.get('clientSecret'),
              redirectUri: formData.get('redirectUri')
            };

            try {
              // Save credentials
              const saveRes = await fetch('/api/setup/google-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials)
              });

              if (!saveRes.ok) {
                const error = await saveRes.json();
                alert('Failed to save credentials: ' + (error.error || 'Unknown error'));
                return;
              }

              // Get auth URL
              const authRes = await fetch('/api/setup/google-auth');
              if (!authRes.ok) {
                const error = await authRes.json();
                alert('Failed to initiate OAuth: ' + (error.error || 'Unknown error'));
                return;
              }

              const { authUrl } = await authRes.json();
              window.location.href = authUrl;
            } catch (error) {
              alert('Error: ' + error.message);
            }
          });
        `)}
      </script>
    </div>
  );
};

/**
 * Step 2: Sheet Selection
 */
const Step2SheetSelection: FC<{ sheets?: Array<{ id: string; name: string; url: string }> }> = ({
  sheets = [],
}) => {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb',
      }}
    >
      <h2 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 16px 0' }}>
        Select Google Sheet
      </h2>
      <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px 0' }}>
        Choose the Google Sheet you want to use as your database backend.
      </p>

      {sheets.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading sheets...</p>
      ) : (
        <form id="sheet-selection-form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label
              htmlFor="sheetId"
              style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}
            >
              Available Sheets
            </label>
            <select
              id="sheetId"
              name="sheetId"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            >
              <option value="">-- Select a sheet --</option>
              {sheets.map((sheet) => (
                <option key={sheet.id} value={sheet.id} data-name={sheet.name}>
                  {sheet.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Initialize Sheet
          </button>
        </form>
      )}

      <script>
        {raw(`
          document.getElementById('sheet-selection-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const select = document.getElementById('sheetId');
            const sheetId = select.value;
            const sheetName = select.options[select.selectedIndex].dataset.name;

            try {
              const res = await fetch('/api/setup/initialize-sheet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sheetId, sheetName })
              });

              if (!res.ok) {
                const error = await res.json();
                alert('Failed to initialize sheet: ' + (error.error || 'Unknown error'));
                return;
              }

              // Redirect to progress page
              window.location.href = '/setup?step=2.5&sheetId=' + encodeURIComponent(sheetId);
            } catch (error) {
              alert('Error: ' + error.message);
            }
          });
        `)}
      </script>
    </div>
  );
};

/**
 * Step 2.5: Sheet Initialization Progress
 */
const Step25SheetInitialization: FC<{
  progress?: { users: boolean; roles: boolean; files: boolean };
}> = ({ progress = { users: false, roles: false, files: false } }) => {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb',
      }}
    >
      <h2 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 16px 0' }}>
        Initializing Sheet
      </h2>
      <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px 0' }}>
        Creating required sheets and setting up headers...
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <ProgressItem label="Creating _Users sheet" completed={progress.users} />
        <ProgressItem label="Creating _Roles sheet" completed={progress.roles} />
        <ProgressItem label="Creating _Files sheet" completed={progress.files} />
      </div>

      {progress.users && progress.roles && progress.files && (
        <div style={{ marginTop: '24px' }}>
          <p style={{ color: '#10b981', fontSize: '14px', fontWeight: '500', marginBottom: '16px' }}>
            ✓ Sheet initialization completed!
          </p>
          <a
            href="/setup?step=3"
            style={{
              display: 'inline-block',
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '12px 24px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            Continue to Final Configuration
          </a>
        </div>
      )}
    </div>
  );
};

const ProgressItem: FC<{ label: string; completed: boolean }> = ({ label, completed }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: completed ? '#10b981' : '#e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '12px',
        }}
      >
        {completed ? '✓' : '...'}
      </div>
      <span style={{ fontSize: '14px', color: completed ? '#10b981' : '#6b7280' }}>{label}</span>
    </div>
  );
};

/**
 * Step 3: Final Configuration (File Storage & Admin User)
 */
const Step3FinalConfiguration: FC = () => {
  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb',
      }}
    >
      <h2 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 16px 0' }}>
        Final Configuration
      </h2>
      <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px 0' }}>
        Configure file storage, create admin user, and set master key.
      </p>

      <form id="final-config-form" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* File Storage Configuration */}
        <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '16px' }}>
          <legend style={{ fontSize: '16px', fontWeight: '500', padding: '0 8px' }}>
            File Storage
          </legend>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <input type="radio" name="storageType" value="google_drive" checked />
              <span>Google Drive</span>
            </label>
            <input
              type="text"
              name="googleDriveFolderId"
              placeholder="Google Drive Folder ID"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <input type="radio" name="storageType" value="r2" />
              <span>Cloudflare R2</span>
            </label>
            <div id="r2-fields" style={{ display: 'none', gap: '12px', flexDirection: 'column' }}>
              <input
                type="text"
                name="r2BucketName"
                placeholder="Bucket Name"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
              <input
                type="text"
                name="r2AccountId"
                placeholder="Account ID"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
              <input
                type="text"
                name="r2AccessKeyId"
                placeholder="Access Key ID"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
              <input
                type="password"
                name="r2SecretAccessKey"
                placeholder="Secret Access Key"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                }}
              />
            </div>
          </div>
        </fieldset>

        {/* Admin User Configuration */}
        <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '16px' }}>
          <legend style={{ fontSize: '16px', fontWeight: '500', padding: '0 8px' }}>
            Initial Admin User
          </legend>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="text"
              name="adminUserId"
              placeholder="Admin User ID"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
            <input
              type="password"
              name="adminPassword"
              placeholder="Admin Password"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
            <input
              type="password"
              name="adminPasswordConfirm"
              placeholder="Confirm Password"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
          </div>
        </fieldset>

        {/* Master Key Configuration */}
        <fieldset style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '16px' }}>
          <legend style={{ fontSize: '16px', fontWeight: '500', padding: '0 8px' }}>Master Key</legend>

          <input
            type="password"
            name="masterKey"
            placeholder="Master Key (for ACL bypass)"
            required
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
            }}
          />
          <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
            This key allows bypassing all access control. Keep it secure!
          </p>
        </fieldset>

        <button
          type="submit"
          style={{
            backgroundColor: '#10b981',
            color: 'white',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          Complete Setup
        </button>
      </form>

      <script>
        {raw(`
          // Toggle R2 fields visibility
          document.querySelectorAll('input[name="storageType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
              const r2Fields = document.getElementById('r2-fields');
              r2Fields.style.display = e.target.value === 'r2' ? 'flex' : 'none';
            });
          });

          // Form submission
          document.getElementById('final-config-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);

            // Password validation
            if (formData.get('adminPassword') !== formData.get('adminPasswordConfirm')) {
              alert('Passwords do not match!');
              return;
            }

            // Build request body
            const storageType = formData.get('storageType');
            const fileStorage = storageType === 'google_drive'
              ? { type: 'google_drive', googleDriveFolderId: formData.get('googleDriveFolderId') }
              : {
                  type: 'r2',
                  r2Config: {
                    bucketName: formData.get('r2BucketName'),
                    accountId: formData.get('r2AccountId'),
                    accessKeyId: formData.get('r2AccessKeyId'),
                    secretAccessKey: formData.get('r2SecretAccessKey')
                  }
                };

            const requestBody = {
              sheetId: new URLSearchParams(window.location.search).get('sheetId'),
              sheetName: 'Selected Sheet', // TODO: Get from query or session
              fileStorage,
              adminUser: {
                userId: formData.get('adminUserId'),
                password: formData.get('adminPassword')
              },
              masterKey: formData.get('masterKey')
            };

            try {
              const res = await fetch('/api/setup/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
              });

              if (!res.ok) {
                const error = await res.json();
                alert('Failed to complete setup: ' + (error.error || 'Unknown error'));
                return;
              }

              alert('Setup completed successfully!');
              window.location.href = '/';
            } catch (error) {
              alert('Error: ' + error.message);
            }
          });
        `)}
      </script>
    </div>
  );
};
