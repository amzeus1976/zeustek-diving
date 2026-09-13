CREATE TABLE `journal_entries` (`id` text PRIMARY KEY NOT NULL,`user_id` text NOT NULL,`occurred_at` integer NOT NULL,`timezone` text NOT NULL,`title` text,`rating` integer,`status` text DEFAULT 'published' NOT NULL,`created_at` integer NOT NULL);
--> statement-breakpoint
CREATE TABLE `journal_revisions` (`id` text PRIMARY KEY NOT NULL,`entry_id` text NOT NULL,`revision_number` integer NOT NULL,`base_revision_id` text,`client_revision_id` text NOT NULL UNIQUE,`origin` text NOT NULL,`content_format` text NOT NULL,`content` text NOT NULL,`created_at` integer NOT NULL);
--> statement-breakpoint
CREATE INDEX `idx_journal_entries_user_time` ON `journal_entries` (`user_id`,`occurred_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_journal_revision_number` ON `journal_revisions` (`entry_id`,`revision_number`);
