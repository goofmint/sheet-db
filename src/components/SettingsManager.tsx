/**
 * Settings Manager Component (Client-side)
 * Handles system settings management with React
 */

import { useState, useEffect } from 'hono/jsx';
import type { SettingDefinition, SettingValue } from '../types/settings';

interface SettingsData {
  settings: Record<string, SettingValue | null>;
  definitions: SettingDefinition[];
}

export function SettingsManager() {
  const [settings, setSettings] = useState<Record<string, SettingValue | null>>(
    {}
  );
  const [definitions, setDefinitions] = useState<SettingDefinition[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Failed to load settings');

      const data: SettingsData = await response.json();
      setSettings(data.settings);
      setDefinitions(data.definitions);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load settings'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (key: string, value: SettingValue) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!isDirty) {
      setSuccess('No changes to save');
      return;
    }

    setIsSaving(true);
    setError(undefined);
    setSuccess(undefined);

    try {
      const updatedSettings: Record<string, SettingValue> = {};

      for (const def of definitions) {
        const value = settings[def.key];

        // Skip sensitive settings if empty or null
        if (def.sensitive && (value === '' || value === null)) {
          continue;
        }

        if (value !== null && value !== undefined) {
          updatedSettings[def.key] = value;
        }
      }

      const response = await fetch('/api/settings/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updatedSettings }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { message?: string };
        throw new Error(data.message || 'Failed to save settings');
      }

      setIsDirty(false);
      setSuccess('Settings saved successfully');
      await loadSettings(); // Reload to show updated values
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save settings'
      );
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue =
          'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  if (isLoading) {
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
    );
  }

  // Group definitions by category
  const categories: Record<string, SettingDefinition[]> = {};
  for (const def of definitions) {
    if (!categories[def.category]) {
      categories[def.category] = [];
    }
    categories[def.category].push(def);
  }

  return (
    <div>
      {error && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px',
            color: '#991b1b',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px',
            color: '#166534',
          }}
        >
          {success}
        </div>
      )}

      {Object.entries(categories).map(([category, defs]) => (
        <div
          key={category}
          style={{
            background: 'white',
            borderRadius: '8px',
            padding: '24px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb',
          }}
        >
          <h2
            style={{
              fontSize: '20px',
              fontWeight: '600',
              margin: '0 0 16px 0',
              textTransform: 'capitalize',
            }}
          >
            {category}
          </h2>

          {defs.map((def) => (
            <SettingField
              key={def.key}
              definition={def}
              value={settings[def.key] ?? def.defaultValue}
              onChange={(value) => handleChange(def.key, value)}
            />
          ))}
        </div>
      ))}

      <div
        style={{
          position: 'sticky',
          bottom: '16px',
          background: 'white',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb',
        }}
      >
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            background: isSaving ? '#9ca3af' : '#3b82f6',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: '600',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            width: '100%',
          }}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

interface SettingFieldProps {
  definition: SettingDefinition;
  value: SettingValue;
  onChange: (value: SettingValue) => void;
}

function SettingField({ definition, value, onChange }: SettingFieldProps) {
  const inputStyle = {
    width: '100%',
    padding: '8px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
  };

  const sensitivePlaceholder = definition.sensitive
    ? 'Enter to change current value'
    : '';

  const renderInput = () => {
    switch (definition.type) {
      case 'boolean':
        return (
          <input
            type="checkbox"
            id={definition.key}
            checked={Boolean(value)}
            onChange={(e) =>
              onChange((e.target as HTMLInputElement).checked)
            }
            style={{
              width: '20px',
              height: '20px',
              cursor: 'pointer',
            }}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            id={definition.key}
            value={String(value ?? '')}
            onInput={(e) =>
              onChange(parseFloat((e.target as HTMLInputElement).value))
            }
            required={definition.validation?.required}
            min={definition.validation?.min}
            max={definition.validation?.max}
            placeholder={sensitivePlaceholder}
            style={inputStyle}
          />
        );

      case 'password':
        return (
          <input
            type="password"
            id={definition.key}
            value={String(value ?? '')}
            onInput={(e) =>
              onChange((e.target as HTMLInputElement).value)
            }
            required={definition.validation?.required}
            placeholder={sensitivePlaceholder}
            style={inputStyle}
          />
        );

      case 'array':
        return (
          <input
            type="text"
            id={definition.key}
            value={Array.isArray(value) ? value.join(',') : ''}
            onInput={(e) => {
              const val = (e.target as HTMLInputElement).value;
              onChange(
                val
                  .split(',')
                  .map((v) => v.trim())
                  .filter((v) => v)
              );
            }}
            required={definition.validation?.required}
            placeholder={sensitivePlaceholder || 'Comma-separated values'}
            style={inputStyle}
          />
        );

      default:
        return (
          <input
            type="text"
            id={definition.key}
            value={String(value ?? '')}
            onInput={(e) =>
              onChange((e.target as HTMLInputElement).value)
            }
            required={definition.validation?.required}
            placeholder={sensitivePlaceholder}
            style={inputStyle}
          />
        );
    }
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <label
        htmlFor={definition.key}
        style={{
          display: 'block',
          fontWeight: '500',
          marginBottom: '4px',
          fontSize: '14px',
        }}
      >
        {definition.label}
        {definition.validation?.required && (
          <span style={{ color: '#ef4444' }}>*</span>
        )}
      </label>
      <p
        style={{
          color: '#6b7280',
          fontSize: '12px',
          margin: '0 0 8px 0',
        }}
      >
        {definition.description}
      </p>
      {renderInput()}
    </div>
  );
}
