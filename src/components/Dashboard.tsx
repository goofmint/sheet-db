/**
 * Dashboard component - main admin panel view
 *
 * Displays system overview and quick actions.
 * This is a server-side rendered component using Hono JSX.
 */

import type { FC } from 'hono/jsx';

/**
 * Dashboard statistics card
 */
interface StatCard {
  title: string;
  value: string | number;
  description?: string;
  icon: string;
}

/**
 * Dashboard component - main landing page
 *
 * Features:
 * - Welcome message
 * - System status cards (placeholder)
 * - Quick action buttons
 * - Grid layout for stat cards
 *
 * Note: Initial implementation shows placeholders.
 * Future tasks will populate with real data.
 */
export const Dashboard: FC = () => {
  // Placeholder stat cards
  const stats: StatCard[] = [
    {
      title: 'Total API Calls',
      value: '0',
      description: 'Last 24 hours',
      icon: '📊',
    },
    {
      title: 'Cache Hit Rate',
      value: 'N/A',
      description: 'Cache performance',
      icon: '⚡',
    },
    {
      title: 'Active Sessions',
      value: '0',
      description: 'Current user sessions',
      icon: '👥',
    },
    {
      title: 'Database Status',
      value: 'Healthy',
      description: 'D1 connection',
      icon: '✅',
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0' }}>
          Dashboard
        </h1>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Welcome to Sheet DB Admin Panel
        </p>
      </div>

      {/* Stat cards grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '24px',
          marginBottom: '32px',
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.title}
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
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <span style={{ fontSize: '32px', marginRight: '12px' }}>
                {stat.icon}
              </span>
              <h3
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#6b7280',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {stat.title}
              </h3>
            </div>
            <p
              style={{
                fontSize: '36px',
                fontWeight: 'bold',
                color: '#111827',
                margin: '0 0 8px 0',
              }}
            >
              {stat.value}
            </p>
            {stat.description && (
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                {stat.description}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e5e7eb',
        }}
      >
        <h2 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 16px 0' }}>
          Quick Actions
        </h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a
            href="/setup"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            🔧 Initial Setup
          </a>
          <a
            href="/settings"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#6b7280',
              color: 'white',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            ⚙️ System Settings
          </a>
          <a
            href="/api/health"
            target="_blank"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#10b981',
              color: 'white',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            🏥 Health Check
          </a>
        </div>
      </div>
    </div>
  );
};
