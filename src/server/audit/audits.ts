import { env } from "cloudflare:workers";
import type { EveryAppUser } from "@every-app/sdk/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditIssues, auditPages, audits, projects } from "@/db/schema";
import { PAGE_LIMITS, RULES, SEVERITY_ORDER, type RuleId, type Severity } from "@/shared/auditRules";
import { UserFacingError } from "@/server/errors";
import { projectFor, type Project } from "@/server/projects";

export const startAuditInput = z
  .object({
    projectId: z.string().min(1),
    pageLimit: z.number().int().refine((n) => (PAGE_LIMITS as readonly number[]).includes(n), "Pick a page limit"),
  })
  .strict();
export const auditViewInput = z
  .object({ projectId: z.string().min(1), auditId: z.string().min(1).optional() })
  .strict();

/** An audit still queued or running after this long is treated as stuck. */
const STUCK = "-3 hours";

/**
 * Queues an audit unless one is already queued or running for the project:
 * one statement, so two clicks can't both start one.
 */
export async function queueAudit(project: Project, pageLimit: number): Promise<string | null> {
  const id = crypto.randomUUID();
  const inserted = await db.all<{ id: string }>(sql`
    INSERT INTO audits (id, project_id, status, page_limit)
    SELECT ${id}, ${project.id}, 'queued', ${pageLimit}
    WHERE NOT EXISTS (
      SELECT 1 FROM audits WHERE project_id = ${project.id} AND status IN ('queued', 'running')
        AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ${STUCK})
    )
    RETURNING id`);
  if (inserted.length === 0) return null;
  await env.SITE_AUDIT.create({ id, params: { auditId: id, projectId: project.id } });
  return id;
}

export async function startAudit(user: EveryAppUser, input: z.infer<typeof startAuditInput>): Promise<string> {
  const project = await projectFor(user, input.projectId);
  const id = await queueAudit(project, input.pageLimit);
  if (!id) throw new UserFacingError("An audit is already running for this project");
  return id;
}

/** The weekly rerun for projects that asked for it. */
export async function scheduledAudits(): Promise<void> {
  const rows = await db.select().from(projects).where(eq(projects.auditWeekly, true));
  for (const project of rows) {
    const [last] = await db.select({ pageLimit: audits.pageLimit }).from(audits).where(eq(audits.projectId, project.id)).orderBy(desc(audits.createdAt)).limit(1);
    await queueAudit(project, last?.pageLimit ?? 100);
  }
}

export interface AuditView {
  weekly: boolean;
  history: { id: string; status: string; score: number | null; pages: number; at: string }[];
  audit: {
    id: string;
    status: "queued" | "running" | "done" | "failed";
    stuck: boolean;
    pageLimit: number;
    pagesCrawled: number;
    score: number | null;
    error: string | null;
    at: string;
    counts: Record<Severity, number>;
    issues: {
      rule: RuleId;
      title: string;
      severity: Severity;
      category: string;
      tip: string;
      count: number;
      pages: { url: string; detail: string | null }[];
    }[];
    pages: { url: string; status: number; title: string | null; issues: number }[];
  } | null;
}

export async function auditView(user: EveryAppUser, input: z.infer<typeof auditViewInput>): Promise<AuditView> {
  const project = await projectFor(user, input.projectId);
  const history = await db
    .select()
    .from(audits)
    .where(eq(audits.projectId, project.id))
    .orderBy(desc(audits.createdAt))
    .limit(52);
  const chosen = input.auditId ? history.find((a) => a.id === input.auditId) : history[0];
  let audit: AuditView["audit"] = null;
  if (chosen) {
    const [issues, pages] = await Promise.all([
      db.select().from(auditIssues).where(and(eq(auditIssues.auditId, chosen.id), eq(auditIssues.projectId, project.id))),
      db.select().from(auditPages).where(and(eq(auditPages.auditId, chosen.id), eq(auditPages.projectId, project.id))).orderBy(auditPages.url),
    ]);
    const byRule = new Map<RuleId, { url: string; detail: string | null }[]>();
    for (const issue of issues) {
      const rule = issue.rule as RuleId;
      if (!(rule in RULES)) continue;
      byRule.set(rule, [...(byRule.get(rule) ?? []), { url: issue.url, detail: issue.detail }]);
    }
    const grouped = [...byRule].map(([rule, affected]) => ({
      rule,
      ...RULES[rule],
      count: affected.length,
      pages: affected.slice(0, 200),
    }));
    grouped.sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
        a.category.localeCompare(b.category) ||
        b.count - a.count,
    );
    const counts = { error: 0, warning: 0, notice: 0 };
    for (const g of grouped) counts[g.severity] += g.count;
    const active = chosen.status === "queued" || chosen.status === "running";
    audit = {
      id: chosen.id,
      status: chosen.status,
      stuck: active && Date.now() - Date.parse(chosen.createdAt) > 3 * 3600_000,
      pageLimit: chosen.pageLimit,
      pagesCrawled: chosen.pagesCrawled,
      score: chosen.score,
      error: chosen.error,
      at: chosen.finishedAt ?? chosen.createdAt,
      counts,
      issues: grouped,
      pages: pages.map((p) => ({ url: p.url, status: p.status, title: p.title, issues: p.issueCount })),
    };
  }
  return {
    weekly: project.auditWeekly,
    history: history.map((a) => ({
      id: a.id,
      status: a.status,
      score: a.score,
      pages: a.pagesCrawled,
      at: a.finishedAt ?? a.createdAt,
    })),
    audit,
  };
}
