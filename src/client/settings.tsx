/**
 * Client-side entry point for Settings component
 */

import { render } from 'hono/jsx/dom';
import { SettingsManager } from '../components/SettingsManager';

// Render the SettingsManager component
const root = document.getElementById('app');
if (root) {
  render(<SettingsManager />, root);
}
