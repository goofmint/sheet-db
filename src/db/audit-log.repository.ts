/**
 * Audit Log Repository
 * Handles persistence of audit log entries to D1 database
 * Task 2.2: Only implements logging functionality (no query/display)
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { CreateAuditLog } from '../types/audit-log';
import { ulid } from 'ulid';

/**
 * Repository for managing audit logs in D1 database
 */
export class AuditLogRepository {
  constructor(private db: D1Database) {}

  /**
   * Record an audit log entry
   * Automatically generates ID and timestamp
   *
   * @param log - Audit log data without id and timestamp
   * @throws Error if database insert fails
   */
  async logChange(log: CreateAuditLog): Promise<void> {
    const id = ulid();
    const timestamp = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO audit_logs (
          id, timestamp, user_id, action, target_type, target_key,
          old_value, new_value, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        timestamp,
        log.userId,
        log.action,
        log.targetType,
        log.targetKey,
        log.oldValue ?? null,
        log.newValue ?? null,
        log.ipAddress ?? null,
        log.userAgent ?? null
      )
      .run();
  }
}
