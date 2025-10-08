/**
 * Audit Log Types
 * Used to track all system changes for security and compliance
 */

/**
 * Action types for audit logging
 */
export type AuditAction = 'create' | 'update' | 'delete';

/**
 * Target types that can be audited
 */
export type AuditTargetType = 'config' | 'user' | 'role' | 'data';

/**
 * Audit log entry structure
 * Represents a single auditable action in the system
 */
export interface AuditLog {
  /** Unique identifier (ULID format) */
  id: string;
  /** ISO 8601 timestamp when the action occurred */
  timestamp: string;
  /** ID of the user who performed the action */
  userId: string;
  /** Type of action performed */
  action: AuditAction;
  /** Type of resource being modified */
  targetType: AuditTargetType;
  /** Specific key/identifier of the target resource */
  targetKey: string;
  /** Previous value before the change (JSON string) */
  oldValue?: string;
  /** New value after the change (JSON string) */
  newValue?: string;
  /** IP address of the request origin */
  ipAddress?: string;
  /** User agent string from the request */
  userAgent?: string;
}

/**
 * Partial audit log for creating new entries
 * Omits auto-generated fields (id, timestamp)
 */
export type CreateAuditLog = Omit<AuditLog, 'id' | 'timestamp'>;
