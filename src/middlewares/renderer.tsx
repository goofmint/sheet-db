import { jsxRenderer } from 'hono/jsx-renderer';

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sheet DB Admin</title>
        <script type="module" src="/static/client.js" />
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
});
