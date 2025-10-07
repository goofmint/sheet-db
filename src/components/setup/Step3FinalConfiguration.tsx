/**
 * Step 3: Final Configuration Component
 *
 * Handles file storage configuration, admin user creation, and master key setup
 */

import type { FC } from 'hono/jsx/dom';
import { useEffect, useCallback } from 'hono/jsx/dom';
import { styles } from '../Setup.css';

/**
 * Step 3: Final Configuration (File Storage & Admin User)
 */
export const Step3FinalConfiguration: FC = () => {
  useEffect(() => {
    const radios = document.querySelectorAll('input[name="storageType"]');
    const handleStorageTypeChange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const r2Fields = document.getElementById('r2-fields');
      if (r2Fields) {
        r2Fields.style.display = target.value === 'r2' ? 'flex' : 'none';
      }
    };

    radios.forEach((radio: Element) => {
      radio.addEventListener('change', handleStorageTypeChange);
    });

    return () => {
      radios.forEach((radio: Element) => {
        radio.removeEventListener('change', handleStorageTypeChange);
      });
    };
  }, []);

  const handleSubmit = useCallback(async (e: Event) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    if (formData.get('adminPassword') !== formData.get('adminPasswordConfirm')) {
      alert('Passwords do not match!');
      return;
    }

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

    const urlParams = new URLSearchParams(window.location.search);
    const requestBody = {
      sheetId: urlParams.get('sheetId'),
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
        const error = await res.json() as { error?: string };
        alert('Failed to complete setup: ' + (error.error || 'Unknown error'));
        return;
      }

      alert('Setup completed successfully!');
      window.location.href = '/';
    } catch (error) {
      alert('Error: ' + ((error as Error)?.message || 'Unknown error'));
    }
  }, []);

  return (
    <div
      style={styles.card}
    >
      <h2 style={styles.cardTitle}>
        Final Configuration
      </h2>
      <p style={{ ...styles.cardDescription, margin: '0 0 24px 0' }}>
        Configure file storage, create admin user, and set master key.
      </p>

      <form onSubmit={handleSubmit} style={styles.formLarge}>
        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>
            File Storage
          </legend>

          <div style={styles.marginBottom16}>
            <label style={styles.radioLabel}>
              <input type="radio" name="storageType" value="google_drive" checked />
              <span>Google Drive</span>
            </label>
            <input
              type="text"
              name="googleDriveFolderId"
              placeholder="Google Drive Folder ID"
              style={styles.input}
            />
          </div>

          <div>
            <label style={styles.radioLabel}>
              <input type="radio" name="storageType" value="r2" />
              <span>Cloudflare R2</span>
            </label>
            <div id="r2-fields" style={styles.r2Fields}>
              <input
                type="text"
                name="r2BucketName"
                placeholder="Bucket Name"
                style={styles.input}
              />
              <input
                type="text"
                name="r2AccountId"
                placeholder="Account ID"
                style={styles.input}
              />
              <input
                type="text"
                name="r2AccessKeyId"
                placeholder="Access Key ID"
                style={styles.input}
              />
              <input
                type="password"
                name="r2SecretAccessKey"
                placeholder="Secret Access Key"
                style={styles.input}
              />
            </div>
          </div>
        </fieldset>

        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>
            Initial Admin User
          </legend>

          <div style={styles.flexColumn}>
            <input
              type="text"
              name="adminUserId"
              placeholder="Admin User ID"
              required
              style={styles.input}
            />
            <input
              type="password"
              name="adminPassword"
              placeholder="Admin Password"
              required
              style={styles.input}
            />
            <input
              type="password"
              name="adminPasswordConfirm"
              placeholder="Confirm Password"
              required
              style={styles.input}
            />
          </div>
        </fieldset>

        <fieldset style={styles.fieldset}>
          <legend style={styles.legend}>Master Key</legend>

          <input
            type="password"
            name="masterKey"
            placeholder="Master Key (for ACL bypass)"
            required
            style={styles.input}
          />
          <p style={{ ...styles.inputHelp, marginTop: '8px' }}>
            This key allows bypassing all access control. Keep it secure!
          </p>
        </fieldset>

        <button
          type="submit"
          style={styles.buttonSuccess}
        >
          Complete Setup
        </button>
      </form>
    </div>
  );
};
