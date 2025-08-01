PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_Config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`type` text DEFAULT 'string' NOT NULL,
	`description` text,
	`system_config` integer DEFAULT 0 NOT NULL,
	`validation` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "type_check" CHECK("__new_Config"."type" IN ('string', 'number', 'boolean', 'json')),
	CONSTRAINT "system_config_check" CHECK("__new_Config"."system_config" IN (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_Config`("id", "key", "value", "type", "description", "system_config", "validation", "created_at", "updated_at") SELECT "id", "key", "value", "type", "description", 0, NULL, "created_at", "updated_at" FROM `Config`;--> statement-breakpoint
DROP TABLE `Config`;--> statement-breakpoint
ALTER TABLE `__new_Config` RENAME TO `Config`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `Config_key_unique` ON `Config` (`key`);