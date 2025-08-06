CREATE TABLE `RefreshToken` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_id` text NOT NULL,
	`user_id` text NOT NULL,
	`refresh_token` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`used_at` text,
	`is_revoked` integer DEFAULT 0 NOT NULL,
	`ip_address` text,
	`user_agent` text,
	CONSTRAINT "is_revoked_check" CHECK("RefreshToken"."is_revoked" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `RefreshToken_token_id_unique` ON `RefreshToken` (`token_id`);--> statement-breakpoint
CREATE TABLE `TokenAuditLog` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_id` text NOT NULL,
	`user_id` text NOT NULL,
	`event_type` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP,
	`details` text,
	CONSTRAINT "event_type_check" CHECK("TokenAuditLog"."event_type" IN ('created', 'used', 'reused', 'revoked'))
);
