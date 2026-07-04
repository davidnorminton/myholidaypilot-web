CREATE TABLE `builds` (
	`country_id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`flag` text,
	`blurb` text,
	`stage` integer DEFAULT 0 NOT NULL,
	`guides` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE TABLE `build_regions` (
	`id` text PRIMARY KEY NOT NULL,
	`country_id` text NOT NULL,
	`region_id` text NOT NULL,
	`data` text NOT NULL,
	`places_done` integer DEFAULT 0 NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`country_id`) REFERENCES `builds`(`country_id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `build_region_uq` ON `build_regions` (`country_id`,`region_id`);--> statement-breakpoint
CREATE TABLE `build_places` (
	`id` text PRIMARY KEY NOT NULL,
	`country_id` text NOT NULL,
	`region_id` text NOT NULL,
	`place_id` text NOT NULL,
	`data` text NOT NULL,
	`image` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`country_id`) REFERENCES `builds`(`country_id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `build_place_uq` ON `build_places` (`country_id`,`region_id`,`place_id`);
