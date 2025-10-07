/**
 * Step 2: Sheet Selection Component
 *
 * Allows user to select a Google Sheet for database backend
 */

import type { FC } from 'hono/jsx/dom';
import { useState, useCallback } from 'hono/jsx/dom';
import { styles } from '../Setup.css';

interface Sheet {
  id: string;
  name: string;
  url: string;
}

interface Step2SheetSelectionProps {
  sheets?: Sheet[];
}

interface ProgressMessage {
  type: 'info' | 'success' | 'error';
  message: string;
}

/**
 * Step 2: Sheet Selection
 */
export const Step2SheetSelection: FC<Step2SheetSelectionProps> = ({
  sheets = [],
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [progressMessages, setProgressMessages] = useState<ProgressMessage[]>([]);

  const handleSubmit = useCallback(async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const sheetId = formData.get('sheetId') as string;

    if (!sheetId) {
      alert('Please select a sheet');
      return;
    }

    setIsLoading(true);
    setProgressMessages([{ type: 'info', message: 'Starting initialization...' }]);

    try {
      const res = await fetch('/api/setup/initialize-sheet-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId })
      });

      if (!res.ok) {
        const error = await res.json() as { error?: string };
        setProgressMessages([{ type: 'error', message: '✗ ' + (error.error || 'Unknown error') }]);
        setIsLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';
      const sheetProgress: Record<string, string> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          const eventMatch = line.match(/^event: (.+)$/m);
          const dataMatch = line.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const eventType = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);

          if (eventType === 'progress') {
            sheetProgress[data.sheet] = data.message;
            const messages: ProgressMessage[] = Object.values(sheetProgress).map(msg => ({
              type: 'info' as const,
              message: msg
            }));
            setProgressMessages(messages);
            continue;
          }

          if (eventType === 'error') {
            setProgressMessages(prev => [...prev, { type: 'error', message: '✗ ' + data.message }]);
            continue;
          }

          if (eventType === 'complete') {
            if (data.success) {
              setProgressMessages(prev => [...prev, {
                type: 'success',
                message: '✓ All sheets initialized successfully!'
              }]);
              setTimeout(() => {
                window.location.href = '/setup?step=3&sheetId=' + encodeURIComponent(sheetId);
              }, 1000);
              return;
            }

            setProgressMessages(prev => [...prev, {
              type: 'error',
              message: '✗ Initialization completed with errors'
            }]);
            setIsLoading(false);
          }
        }
      }
    } catch (error) {
      setProgressMessages([{ type: 'error', message: '✗ Error: ' + (error as Error).message }]);
      setIsLoading(false);
    }
  }, []);

  const getMessageStyle = (type: ProgressMessage['type']) => {
    const baseStyle = { margin: '4px 0' };
    switch (type) {
      case 'success':
        return { ...baseStyle, color: '#10b981', fontWeight: '500', marginTop: '12px' };
      case 'error':
        return { ...baseStyle, color: '#ef4444' };
      default:
        return { ...baseStyle, color: '#6b7280' };
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>Select Google Sheet</h2>
      <p style={{ ...styles.cardDescription, margin: '0 0 24px 0' }}>
        Choose the Google Sheet you want to use as your database backend.
      </p>

      {sheets.length === 0 ? (
        <div>
          <p style={styles.emptyText}>
            No spreadsheets found in your Google Drive.
          </p>
          <div style={styles.warningBox}>
            <p style={styles.warningTitle}>⚠️ Possible Issues:</p>
            <ul style={styles.warningList}>
              <li>Your Google account has no spreadsheets</li>
              <li>You need to re-authenticate after scope changes</li>
              <li>The access token may have expired</li>
            </ul>
          </div>
          <a href="/setup?step=1" style={styles.linkButton}>
            ← Back to Step 1 (Re-authenticate)
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={styles.form}>
          <div>
            <label htmlFor="sheetId" style={styles.inputLabel}>
              Available Sheets
            </label>
            <select
              id="sheetId"
              name="sheetId"
              required
              disabled={isLoading}
              style={styles.select}
            >
              <option value="">-- Select a sheet --</option>
              {sheets.map((sheet) => (
                <option key={sheet.id} value={sheet.id}>
                  {sheet.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              ...styles.buttonPrimary,
              opacity: isLoading ? '0.6' : '1',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? 'Initializing...' : 'Initialize Sheet'}
          </button>

          {progressMessages.length > 0 && (
            <div
              style={{
                marginTop: '16px',
                padding: '16px',
                backgroundColor: '#f3f4f6',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            >
              {progressMessages.map((msg, idx) => (
                <div key={idx} style={getMessageStyle(msg.type)}>
                  {msg.message}
                </div>
              ))}
            </div>
          )}
        </form>
      )}
    </div>
  );
};
