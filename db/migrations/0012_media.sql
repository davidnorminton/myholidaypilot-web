CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`mime` text NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer NOT NULL
);
