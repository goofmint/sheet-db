/**
 * Main layout component with header, sidebar, and content area
 *
 * Used as the base structure for all pages.
 * This is a server-side rendered component using Hono JSX.
 */

import type { FC } from 'hono/jsx';
import { raw } from 'hono/html';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

/**
 * Layout component props
 */
interface LayoutProps {
  children: ReturnType<FC>;
  title?: string;
  environment: string;
  currentPath: string;
}

/**
 * Layout component - provides consistent page structure
 *
 * Structure:
 * - Header: Top navigation bar with app title
 * - Sidebar: Left navigation menu
 * - Main: Content area where children are rendered
 *
 * Styling:
 * - CSS Grid for responsive layout
 * - Flexbox for header and sidebar
 * - Mobile-friendly design
 */
export const Layout: FC<LayoutProps> = ({
  children,
  title = 'Sheet DB Admin',
  environment,
  currentPath,
}) => {
  return (
    <>
      {raw('<!DOCTYPE html>')}
      <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <style>
          {`
            * {
              box-sizing: border-box;
            }
            html {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
            }
            body {
              margin: 0;
              padding: 0;
              width: 100%;
              height: 100%;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
                'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
                sans-serif;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              color: #111827;
              background-color: #ffffff;
            }
            #root {
              display: grid;
              grid-template-rows: 64px 1fr;
              grid-template-columns: 250px 1fr;
              grid-template-areas:
                "header header"
                "sidebar main";
              min-height: 100vh;
            }
            header {
              grid-area: header;
            }
            aside {
              grid-area: sidebar;
            }
            main {
              grid-area: main;
              padding: 24px;
              background-color: #f9fafb;
              overflow-y: auto;
            }
            a:hover {
              opacity: 0.8;
            }
          `}
        </style>
      </head>
      <body>
        <div id="root">
          <Header environment={environment} />
          <Sidebar currentPath={currentPath} />
          <main>{children}</main>
        </div>
      </body>
      </html>
    </>
  );
};
