import { html } from 'hono/html';

export interface ErrorPageProps {
  title: string;
  heading: string;
  message: string;
  backLink?: {
    url: string;
    text: string;
  };
}

export function ErrorPage(props: ErrorPageProps) {
  const { title, heading, message, backLink } = props;
  
  return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          max-width: 600px;
          margin: 2rem auto;
          padding: 1rem;
          line-height: 1.6;
          color: #333;
        }
        .error-container {
          text-align: center;
          padding: 2rem;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          background-color: #fafafa;
        }
        .error-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        h1 {
          color: #d32f2f;
          margin-bottom: 1rem;
        }
        p {
          margin-bottom: 1.5rem;
          color: #666;
        }
        .back-link {
          display: inline-block;
          padding: 0.5rem 1rem;
          background-color: #1976d2;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        .back-link:hover {
          background-color: #1565c0;
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <div class="error-icon">⚠️</div>
        <h1>${heading}</h1>
        <p>${message}</p>
        ${backLink ? html`
          <a href="${backLink.url}" class="back-link">${backLink.text}</a>
        ` : ''}
      </div>
    </body>
    </html>
  `;
}