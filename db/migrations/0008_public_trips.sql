CREATE TABLE `public_trips` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`user_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`country_id` text DEFAULT 'italy' NOT NULL,
	`title` text NOT NULL,
	`story` text,
	`days` integer NOT NULL,
	`place_count` integer NOT NULL,
	`region_names` text DEFAULT '[]',
	`cover_region_id` text,
	`cover_place_id` text,
	`author_name` text,
	`data` text NOT NULL,
	`featured` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'live' NOT NULL,
	`copies` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `public_trips_slug_unique` ON `public_trips` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `pub_owner_trip` ON `public_trips` (`user_id`,`trip_id`);--> statement-breakpoint
CREATE INDEX `pub_status` ON `public_trips` (`status`,`featured`,`created_at`);
