CREATE TABLE `audit_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`audit_id` text NOT NULL,
	`rule` text NOT NULL,
	`url` text NOT NULL,
	`detail` text
);
--> statement-breakpoint
CREATE INDEX `audit_issues_audit` ON `audit_issues` (`audit_id`,`rule`);--> statement-breakpoint
CREATE TABLE `audit_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`audit_id` text NOT NULL,
	`url` text NOT NULL,
	`status` integer NOT NULL,
	`title` text,
	`issue_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_pages_unique` ON `audit_pages` (`audit_id`,`url`);--> statement-breakpoint
CREATE TABLE `audits` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`status` text NOT NULL,
	`page_limit` integer NOT NULL,
	`pages_crawled` integer DEFAULT 0 NOT NULL,
	`score` integer,
	`error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE INDEX `audits_project` ON `audits` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `competitors` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`domain` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitors_unique` ON `competitors` (`project_id`,`domain`);--> statement-breakpoint
CREATE TABLE `keyword_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `keyword_lists_name` ON `keyword_lists` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`audit_weekly` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_owner` ON `projects` (`owner_id`);--> statement-breakpoint
CREATE TABLE `rank_results` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`run_id` text NOT NULL,
	`tracked_keyword_id` text NOT NULL,
	`domain` text NOT NULL,
	`position` integer,
	`url` text,
	`serp_features` text NOT NULL,
	`owned_features` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rank_results_unique` ON `rank_results` (`run_id`,`tracked_keyword_id`,`domain`);--> statement-breakpoint
CREATE INDEX `rank_results_project` ON `rank_results` (`project_id`);--> statement-breakpoint
CREATE TABLE `rank_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE INDEX `rank_runs_project` ON `rank_runs` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `saved_keywords` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`list_id` text NOT NULL,
	`keyword` text NOT NULL,
	`volume` integer,
	`difficulty` integer,
	`cpc` real,
	`intent` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_keywords_unique` ON `saved_keywords` (`list_id`,`keyword`);--> statement-breakpoint
CREATE TABLE `tracked_keywords` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`keyword` text NOT NULL,
	`location_code` integer NOT NULL,
	`device` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracked_keywords_unique` ON `tracked_keywords` (`project_id`,`keyword`,`location_code`,`device`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
