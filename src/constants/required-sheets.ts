/**
 * Required sheets definition for initial setup
 *
 * Defines the system sheets that must be created during setup:
 * - _Users: User account management
 * - _Roles: Role-based access control
 * - _Files: File metadata storage
 */

export interface ColumnDefinition {
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'email';
  unique?: boolean;
  required?: boolean;
  pattern?: string;
  min?: number;
  [key: string]: unknown;
}

export interface RequiredSheet {
  title: string;
  headers: string[];
  columnDefs: ColumnDefinition[];
}

/**
 * System sheets that must be created during setup
 */
export const requiredSheets: RequiredSheet[] = [
  {
    title: '_Users',
    headers: [
      'object_id',
      'username',
      '_password_hash',
      'email',
      'name',
      'status',
      'created_at',
    ],
    columnDefs: [
      { type: 'string', unique: true },
      { type: 'string', unique: true, required: true },
      { type: 'string', required: true },
      { type: 'email', unique: true },
      { type: 'string' },
      { type: 'string' },
      { type: 'date' },
    ],
  },
  {
    title: '_Roles',
    headers: ['object_id', 'name', 'users', 'created_at'],
    columnDefs: [
      { type: 'string', unique: true },
      { type: 'string', unique: true, required: true },
      { type: 'array' },
      { type: 'date' },
    ],
  },
  {
    title: '_Files',
    headers: [
      'object_id',
      'original_name',
      'storage_provider',
      'storage_path',
      'content_type',
      'size_bytes',
      'owner_id',
      'public_read',
      'public_write',
      'users_read',
      'users_write',
      'roles_read',
      'roles_write',
      'created_at',
    ],
    columnDefs: [
      { type: 'string', unique: true },
      { type: 'string', required: true },
      { type: 'string', pattern: '^(r2|google_drive)$' },
      { type: 'string' },
      { type: 'string' },
      { type: 'number', min: 0 },
      { type: 'string' },
      { type: 'boolean' },
      { type: 'boolean' },
      { type: 'array' },
      { type: 'array' },
      { type: 'array' },
      { type: 'array' },
      { type: 'date' },
    ],
  },
];
