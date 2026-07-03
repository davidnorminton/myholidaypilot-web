CREATE TABLE `airports` (
	`id` text PRIMARY KEY NOT NULL,
	`country_id` text NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`iata` text NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`address` text
);--> statement-breakpoint
CREATE INDEX `airport_by_country` ON `airports` (`country_id`);
