CREATE TABLE IF NOT EXISTS `dive_households` (`id` text PRIMARY KEY NOT NULL,`owner_user_id` text,`created_at` integer NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `dive_household_members` (`household_id` text NOT NULL,`user_id` text,`email` text NOT NULL COLLATE NOCASE,`display_name` text NOT NULL,`role` text NOT NULL,`joined_at` integer,PRIMARY KEY(`household_id`,`email`));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_dive_household_members_user` ON `dive_household_members` (`user_id`) WHERE `user_id` IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `dive_household_shares` (`household_id` text NOT NULL,`owner_user_id` text NOT NULL,`area` text NOT NULL,`can_view` integer NOT NULL DEFAULT 0,`can_edit` integer NOT NULL DEFAULT 0,`updated_at` integer NOT NULL,PRIMARY KEY(`household_id`,`owner_user_id`,`area`));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dive_household_shares_owner` ON `dive_household_shares` (`owner_user_id`,`area`);
