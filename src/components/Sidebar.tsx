/**
 * Sidebar component for navigation menu
 *
 * Provides links to different sections of the admin panel.
 * This is a server-side rendered component using Hono JSX.
 */

import type { FC } from 'hono/jsx';

/**
 * Navigation menu item
 */
interface MenuItem {
  label: string;
  path: string;
  icon: string;
}

/**
 * Menu items configuration
 */
const menuItems: MenuItem[] = [
  { label: 'Dashboard', path: '/', icon: '📊' },
  { label: 'System Settings', path: '/settings', icon: '⚙️' },
  { label: 'Initial Setup', path: '/setup', icon: '🔧' },
];

/**
 * Sidebar component - left navigation menu
 *
 * Features:
 * - Vertical menu layout
 * - Icon support for each menu item
 * - Active link highlighting
 * - Fixed width sidebar
 */
export const Sidebar: FC<{ currentPath: string }> = ({ currentPath }) => {
  return (
    <aside
      style={{
        backgroundColor: '#f9fafb',
        borderRight: '1px solid #e5e7eb',
        padding: '16px 0',
      }}
    >
      <nav>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {menuItems.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <li key={item.path} style={{ marginBottom: '4px' }}>
                <a
                  href={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 24px',
                    textDecoration: 'none',
                    color: isActive ? '#3b82f6' : '#111827',
                    backgroundColor: isActive ? '#eff6ff' : 'transparent',
                    borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                    transition: 'all 0.2s',
                    fontSize: '14px',
                    fontWeight: isActive ? '600' : '400',
                  }}
                >
                  <span style={{ marginRight: '12px', fontSize: '18px' }}>
                    {item.icon}
                  </span>
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};
