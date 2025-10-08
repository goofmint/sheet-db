-- Migration: Create audit_logs table
-- Purpose: Track all configuration changes for security and compliance
-- Date: 2025-10-08

CREATE TABLE IF NOT EXISTS `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`timestamp` text NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL CHECK(action IN ('create', 'update', 'delete')),
	`target_type` text NOT NULL CHECK(target_type IN ('config', 'user', 'role', 'data')),
	`target_key` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`ip_address` text,
	`user_agent` text
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_timestamp` ON `audit_logs` (`timestamp`);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_user_id` ON `audit_logs` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_target` ON `audit_logs` (`target_type`, `target_key`);
