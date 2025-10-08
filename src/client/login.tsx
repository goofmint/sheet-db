/**
 * Client-side entry point for Login component
 */

import { render } from 'hono/jsx/dom';
import { LoginForm } from '../components/LoginForm';

// Parse URL parameters
const urlParams = new URLSearchParams(window.location.search);
const error = urlParams.get('error') || undefined;

// Render the LoginForm component
const root = document.getElementById('app');
if (root) {
  render(<LoginForm error={error} />, root);
}
