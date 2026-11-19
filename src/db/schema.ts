import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

// Members as the Gateway names them: created on first sight, keyed by user.id.
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: createdAt(),
});

// A website a member works on. Private to its owner; admins can oversee it.
export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    auditWeekly: integer("audit_weekly", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: createdAt(),
  },
  (t) => [index("projects_owner").on(t.ownerId)],
);

export const keywordLists = sqliteTable(
  "keyword_lists",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("keyword_lists_name").on(t.projectId, t.name)],
);

export const savedKeywords = sqliteTable(
  "saved_keywords",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    listId: text("list_id").notNull(),
    keyword: text("keyword").notNull(),
    volume: integer("volume"),
    difficulty: integer("difficulty"),
    cpc: real("cpc"),
    intent: text("intent"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("saved_keywords_unique").on(t.listId, t.keyword)],
);

export const trackedKeywords = sqliteTable(
  "tracked_keywords",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    keyword: text("keyword").notNull(),
    locationCode: integer("location_code").notNull(),
    device: text("device", { enum: ["desktop", "mobile"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("tracked_keywords_unique").on(
      t.projectId,
      t.keyword,
      t.locationCode,
      t.device,
    ),
  ],
);

export const competitors = sqliteTable(
  "competitors",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    domain: text("domain").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("competitors_unique").on(t.projectId, t.domain)],
);

// One check of every tracked keyword in a project, daily or on demand.
export const rankRuns = sqliteTable(
  "rank_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    status: text("status", { enum: ["running", "done", "failed"] }).notNull(),
    error: text("error"),
    createdAt: createdAt(),
    finishedAt: text("finished_at"),
  },
  (t) => [index("rank_runs_project").on(t.projectId, t.createdAt)],
);

// A position (null: not in the top 100) for one keyword and one domain in a run.
export const rankResults = sqliteTable(
  "rank_results",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    runId: text("run_id").notNull(),
    trackedKeywordId: text("tracked_keyword_id").notNull(),
    domain: text("domain").notNull(),
    position: integer("position"),
    url: text("url"),
    serpFeatures: text("serp_features", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    ownedFeatures: text("owned_features", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("rank_results_unique").on(
      t.runId,
      t.trackedKeywordId,
      t.domain,
    ),
    index("rank_results_project").on(t.projectId),
  ],
);

export const audits = sqliteTable(
  "audits",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    status: text("status", {
      enum: ["queued", "running", "done", "failed"],
    }).notNull(),
    pageLimit: integer("page_limit").notNull(),
    pagesCrawled: integer("pages_crawled").notNull().default(0),
    score: integer("score"),
    error: text("error"),
    createdAt: createdAt(),
    finishedAt: text("finished_at"),
  },
  (t) => [index("audits_project").on(t.projectId, t.createdAt)],
);

export const auditPages = sqliteTable(
  "audit_pages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    auditId: text("audit_id").notNull(),
    url: text("url").notNull(),
    status: integer("status").notNull(),
    title: text("title"),
    issueCount: integer("issue_count").notNull().default(0),
  },
  (t) => [uniqueIndex("audit_pages_unique").on(t.auditId, t.url)],
);

export const auditIssues = sqliteTable(
  "audit_issues",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    auditId: text("audit_id").notNull(),
    rule: text("rule").notNull(),
    url: text("url").notNull(),
    detail: text("detail"),
  },
  (t) => [index("audit_issues_audit").on(t.auditId, t.rule)],
);
