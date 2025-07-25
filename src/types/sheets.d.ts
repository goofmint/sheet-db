// Google Sheets row data
export interface SheetRow {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  
  // Access control fields
  publicRead?: boolean;
  publicWrite?: boolean;
  userRead?: string[];
  userWrite?: string[];
  roleRead?: string[];
  roleWrite?: string[];
  
  // Custom fields (dynamic)
  [key: string]: any;
}

// Sheet schema definition
export interface SheetSchema {
  sheetName: string;
  columns: ColumnDefinition[];
  createdAt: Date;
  updatedAt: Date;
}

// Column definition in sheet schema
export interface ColumnDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'timestamp' | 'string[]' | 'number[]';
  required?: boolean;
  unique?: boolean;
  default?: any;
  pattern?: string;
  min?: number;
  max?: number;
  description?: string;
}

// Sheet metadata
export interface SheetMetadata {
  sheetName: string;
  spreadsheetId: string;
  totalRows: number;
  totalColumns: number;
  lastModified: Date;
  permissions: SheetPermissions;
}

// Sheet permissions
export interface SheetPermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canModifySchema: boolean;
}

// Sheet data query options
export interface SheetQueryOptions {
  select?: string[];
  where?: WhereClause[];
  orderBy?: OrderByClause[];
  limit?: number;
  offset?: number;
}

// Where clause for filtering
export interface WhereClause {
  column: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'startsWith' | 'endsWith';
  value: any;
}

// Order by clause for sorting
export interface OrderByClause {
  column: string;
  direction: 'asc' | 'desc';
}

// File metadata (stored in _File sheet)
export interface FileMetadata {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageType: 'r2' | 'google_drive';
  storagePath: string;
  uploadedBy: string;
  uploadedAt: string;
  
  // Access control
  publicRead: boolean;
  userRead: string[];
  roleRead: string[];
}

// Batch operation result
export interface BatchOperationResult {
  success: number;
  failed: number;
  errors: BatchError[];
  results: any[];
}

export interface BatchError {
  index: number;
  error: string;
  data: any;
}