/**
 * Client-side entry point for Setup component
 */

import { render } from 'hono/jsx/dom';
import { Setup } from '../components/Setup';

// Check if setup is already completed
try {
  const statusRes = await fetch('/setup/status');
  if (statusRes.ok) {
    const { completed } = await statusRes.json() as { completed: boolean };
    if (completed) {
      const root = document.getElementById('app');
      if (root) {
        root.innerHTML = '<div style="text-align: center; padding: 60px 20px; color: #6b7280;">Setup already completed. Please go to the dashboard.</div>';
      }
      throw new Error('Setup already completed');
    }
  }
} catch (e) {
  if (e instanceof Error && e.message === 'Setup already completed') {
    throw e;
  }
  console.error('Failed to check setup status:', e);
}

// Parse URL parameters
const urlParams = new URLSearchParams(window.location.search);
const step = parseInt(urlParams.get('step') || '1');
const error = urlParams.get('error') || undefined;

// Fetch sheets data if on step 2
let sheets: Array<{ id: string; name: string; url: string }> | undefined;
if (step === 2) {
  try {
    const res = await fetch('/api/setup/sheets');
    if (res.ok) {
      const data = await res.json() as { sheets: Array<{ id: string; name: string; url: string }> };
      sheets = data.sheets;
    }
  } catch (e) {
    console.error('Failed to fetch sheets:', e);
  }
}

// Render the Setup component
const root = document.getElementById('app');
if (root) {
  render(<Setup step={step} error={error} sheets={sheets} />, root);
}
