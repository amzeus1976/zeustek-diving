CREATE TABLE `captures` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`content` text NOT NULL,
	`claim_type` text DEFAULT 'observation' NOT NULL,
	`storage_policy` text DEFAULT 'cloud' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_captures_user_created` ON `captures` (`user_id`,`created_at`);
