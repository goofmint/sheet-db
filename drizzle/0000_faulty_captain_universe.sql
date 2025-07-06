CREATE TABLE `Cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`action` text NOT NULL,
	`value` text NOT NULL
);
