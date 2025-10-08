/**
 * System Settings Page
 *
 * Provides UI for managing system configuration settings
 * Dynamically displays settings based on definitions
 * Requires Administrator role
 */

import { Hono } from 'hono';
import type { Env, ContextVariables } from '../../types/env';
import { Layout } from '../../components/Layout';
import { raw } from 'hono/html';
import { requireAuth, requireAdministrator } from '../../middleware/auth';

const settings = new Hono<{ Bindings: Env; Variables: ContextVariables }>();

/**
 * GET /settings - System settings page
 * Displays configuration interface for system administrators
 * Requires authentication and Administrator role
 */
settings.get('/', requireAuth, requireAdministrator, (c) => {
  const environment = c.env.ENVIRONMENT || 'development';

  return c.html(
    <Layout
      title="System Settings - Sheet DB Admin"
      environment={environment}
      currentPath="/settings"
    >
      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
          System Settings
        </h1>
        <p style={{ color: '#6b7280', margin: '0 0 32px 0' }}>
          Configure system-wide settings
        </p>

        <div id="settings-container">
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #e5e7eb',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '40px',
                color: '#6b7280',
              }}
            >
              Loading settings...
            </div>
          </div>
        </div>

        {raw(`
          <script>
            // Settings UI State Management
            let currentSettings = {};
            let settingDefinitions = [];
            let isDirty = false;

            // Fetch settings on page load
            async function loadSettings() {
              try {
                const response = await fetch('/api/settings');
                if (!response.ok) throw new Error('Failed to load settings');

                const data = await response.json();
                currentSettings = data.settings;
                settingDefinitions = data.definitions;

                renderSettings();
              } catch (error) {
                showError('Failed to load settings: ' + error.message);
              }
            }

            // Render settings UI grouped by category
            function renderSettings() {
              const categories = {};

              // Group definitions by category
              settingDefinitions.forEach(def => {
                if (!categories[def.category]) {
                  categories[def.category] = [];
                }
                categories[def.category].push(def);
              });

              // Build HTML
              let html = '';

              Object.entries(categories).forEach(([category, defs]) => {
                html += '<div style="background:white;border-radius:8px;padding:24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.1);border:1px solid #e5e7eb;">';
                html += '<h2 style="font-size:20px;font-weight:600;margin:0 0 16px 0;text-transform:capitalize;">' + category + '</h2>';

                defs.forEach(def => {
                  const value = currentSettings[def.key] ?? def.defaultValue;
                  html += renderSetting(def, value);
                });

                html += '</div>';
              });

              // Add save button
              html += '<div style="position:sticky;bottom:16px;background:white;padding:16px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);border:1px solid #e5e7eb;">';
              html += '<button id="save-btn" onclick="saveSettings()" style="background:#3b82f6;color:white;padding:12px 24px;border-radius:6px;border:none;font-weight:600;cursor:pointer;width:100%;">Save Changes</button>';
              html += '</div>';

              document.getElementById('settings-container').innerHTML = html;
            }

            // Render individual setting field
            function renderSetting(def, value) {
              let inputHtml = '';
              const inputStyle = 'width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;';
              const required = def.validation?.required ? 'required' : '';
              const requiredMark = def.validation?.required ? '<span style="color:#ef4444;">*</span>' : '';

              switch (def.type) {
                case 'boolean':
                  inputHtml = '<input type="checkbox" id="' + def.key + '" ' + (value ? 'checked' : '') + ' onchange="markDirty()" style="width:20px;height:20px;cursor:pointer;" />';
                  break;
                case 'number':
                  inputHtml = '<input type="number" id="' + def.key + '" value="' + value + '" onchange="markDirty()" ' + required + ' style="' + inputStyle + '" ';
                  if (def.validation?.min !== undefined) inputHtml += 'min="' + def.validation.min + '" ';
                  if (def.validation?.max !== undefined) inputHtml += 'max="' + def.validation.max + '" ';
                  inputHtml += '/>';
                  break;
                case 'password':
                  inputHtml = '<input type="password" id="' + def.key + '" value="' + value + '" onchange="markDirty()" ' + required + ' style="' + inputStyle + '" />';
                  break;
                case 'array':
                  inputHtml = '<input type="text" id="' + def.key + '" value="' + (Array.isArray(value) ? value.join(',') : '') + '" onchange="markDirty()" ' + required + ' placeholder="Comma-separated values" style="' + inputStyle + '" />';
                  break;
                default:
                  inputHtml = '<input type="text" id="' + def.key + '" value="' + value + '" onchange="markDirty()" ' + required + ' style="' + inputStyle + '" />';
              }

              return '<div style="margin-bottom:16px;">' +
                '<label style="display:block;font-weight:500;margin-bottom:4px;font-size:14px;">' + def.label + ' ' + requiredMark + '</label>' +
                '<p style="color:#6b7280;font-size:12px;margin:0 0 8px 0;">' + def.description + '</p>' +
                inputHtml +
                '</div>';
            }

            // Mark form as dirty
            function markDirty() {
              isDirty = true;
            }

            // Save settings
            async function saveSettings() {
              if (!isDirty) {
                showSuccess('No changes to save');
                return;
              }

              const updatedSettings = {};

              settingDefinitions.forEach(def => {
                const element = document.getElementById(def.key);
                if (!element) return;

                let value;
                switch (def.type) {
                  case 'boolean':
                    value = element.checked;
                    break;
                  case 'number':
                    value = parseFloat(element.value);
                    break;
                  case 'array':
                    value = element.value.split(',').map(v => v.trim()).filter(v => v);
                    break;
                  default:
                    value = element.value;
                }

                updatedSettings[def.key] = value;
              });

              try {
                const response = await fetch('/api/settings/bulk', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ settings: updatedSettings })
                });

                if (!response.ok) {
                  const error = await response.json();
                  throw new Error(error.message || 'Failed to save settings');
                }

                isDirty = false;
                showSuccess('Settings saved successfully');
                await loadSettings(); // Reload to show updated values
              } catch (error) {
                showError('Failed to save settings: ' + error.message);
              }
            }

            // Show success message
            function showSuccess(message) {
              alert('✓ ' + message);
            }

            // Show error message
            function showError(message) {
              alert('✗ ' + message);
            }

            // Load settings on page load
            document.addEventListener('DOMContentLoaded', loadSettings);

            // Warn about unsaved changes
            window.addEventListener('beforeunload', (e) => {
              if (isDirty) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
              }
            });
          </script>
        `)}
      </div>
    </Layout>
  );
});

export default settings;
