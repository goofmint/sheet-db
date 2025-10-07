/**
 * Header component for top navigation bar
 *
 * Displays application title and environment indicator.
 * This is a server-side rendered component using Hono JSX.
 */

import type { FC } from 'hono/jsx';

/**
 * Header component - top navigation bar
 *
 * Features:
 * - Application title
 * - Environment indicator (development/production)
 * - Fixed height layout
 */
export const Header: FC<{ environment: string }> = ({ environment }) => {
  return (
    <header
      style={{
        backgroundColor: '#3b82f6',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
        Sheet DB Admin
      </h1>
      <div
        style={{
          padding: '4px 12px',
          backgroundColor: environment === 'production' ? '#ef4444' : '#10b981',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: '600',
          textTransform: 'uppercase',
        }}
      >
        {environment}
      </div>
    </header>
  );
};
