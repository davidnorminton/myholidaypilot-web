CREATE TABLE `region_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`country_id` text DEFAULT 'italy' NOT NULL,
	`region_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX `visit_user_region` ON `region_visits` (`user_id`,`region_id`);--> statement-breakpoint
CREATE INDEX `visit_by_user` ON `region_visits` (`user_id`);
