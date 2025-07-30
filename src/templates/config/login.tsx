import { html } from 'hono/html';
import { HtmlEscapedString } from 'hono/utils/html';

interface LoginFormProps {
  csrfToken: string;
}

export function LoginForm({ csrfToken }: LoginFormProps) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Configuration Management - SheetDB</title>
      <link rel="stylesheet" href="/config/styles.css">
    </head>
    <body>
      <div class="auth-form">
        <h1>⚙️ Configuration Management</h1>
        <p>A password is required to access the configuration screen.</p>
        <form method="post" action="/config/auth">
          <input type="hidden" name="csrf_token" value="${csrfToken}">
          <input type="password" name="password" placeholder="Configuration Password" required>
          <button type="submit">Login</button>
        </form>
        <div class="error" id="error" style="display: none;"></div>
      </div>
    </body>
    </html>
  `;
}