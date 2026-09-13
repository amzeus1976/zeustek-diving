CREATE TABLE `dive_records` (`id` text PRIMARY KEY NOT NULL,`user_id` text NOT NULL,`kind` text NOT NULL,`data_json` text NOT NULL,`created_at` integer NOT NULL,`updated_at` integer NOT NULL,`deleted_at` integer);
--> statement-breakpoint
CREATE INDEX `idx_dive_records_user_kind` ON `dive_records` (`user_id`,`kind`,`updated_at`);
