CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`country_id` text NOT NULL,
	`target_type` text NOT NULL,
	`region_id` text NOT NULL,
	`place_id` text,
	`parent_id` text,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cmt_by_area` ON `comments` (`country_id`,`target_type`,`region_id`,`place_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `cmt_by_parent` ON `comments` (`parent_id`);--> statement-breakpoint
CREATE INDEX `cmt_by_user` ON `comments` (`user_id`);