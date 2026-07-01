CREATE TABLE `blog_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`dek` text,
	`cover_image` text,
	`tag` text,
	`author` text,
	`body` text NOT NULL,
	`tags` text DEFAULT '[]',
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_posts_slug_unique` ON `blog_posts` (`slug`);--> statement-breakpoint
CREATE INDEX `post_status_date` ON `blog_posts` (`status`,`published_at`);--> statement-breakpoint
CREATE TABLE `favourites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`place_id` text NOT NULL,
	`region_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fav_user_place` ON `favourites` (`user_id`,`place_id`);--> statement-breakpoint
CREATE INDEX `fav_by_user` ON `favourites` (`user_id`);--> statement-breakpoint
CREATE TABLE `trip_places` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`region_id` text NOT NULL,
	`place_id` text NOT NULL,
	`date` text,
	`done` integer DEFAULT false NOT NULL,
	`note` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`attractions` text DEFAULT '[]',
	`restaurants` text DEFAULT '[]',
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tp_trip_place` ON `trip_places` (`trip_id`,`place_id`);--> statement-breakpoint
CREATE INDEX `tp_by_trip` ON `trip_places` (`trip_id`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text DEFAULT 'My trip' NOT NULL,
	`start_date` text,
	`end_date` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trip_by_user` ON `trips` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`picture` text,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);