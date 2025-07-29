CREATE TABLE `Cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cache_key` text NOT NULL,
	`data` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Cache_cache_key_unique` ON `Cache` (`cache_key`);--> statement-breakpoint
CREATE TABLE `Config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`type` text DEFAULT 'string' NOT NULL,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "type_check" CHECK("Config"."type" IN ('string', 'number', 'boolean', 'json'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Config_key_unique` ON `Config` (`key`);--> statement-breakpoint
CREATE TABLE `Session` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_data` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Session_session_id_unique` ON `Session` (`session_id`);