CREATE TABLE `Session` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`given_name` text,
	`family_name` text,
	`nickname` text,
	`picture` text,
	`email_verified` integer,
	`locale` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_login` text,
	`public_read` integer DEFAULT 0,
	`public_write` integer DEFAULT 0,
	`role_read` text DEFAULT '[]',
	`role_write` text DEFAULT '[]',
	`user_read` text DEFAULT '[]',
	`user_write` text DEFAULT '[]'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Config_name_unique` ON `Config` (`name`);