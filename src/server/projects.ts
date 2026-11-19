import { isAdmin, type EveryAppUser } from "@every-app/sdk/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  auditIssues,
  auditPages,
  audits,
  competitors,
  keywordLists,
  projects,
  rankResults,
  rankRuns,
  savedKeywords,
  trackedKeywords,
  users,
} from "@/db/schema";
import { DOMAIN_ERROR, normalizeDomain } from "@/shared/domain";
import { UserFacingError, notFound } from "@/server/errors";
import { visibilityOf } from "@/shared/visibility";

export type Project = typeof projects.$inferSelect;

const domainField = z
  .string()
  .max(300)
  .transform((value, ctx) => {
    const domain = normalizeDomain(value);
    if (!domain) {
      ctx.addIssue({ code: "custom", message: DOMAIN_ERROR });
      return z.NEVER;
    }
    return domain;
  });
const nameField = z.string().trim().min(1, "Give the project a name").max(80);

export const createProjectInput = z
  .object({ name: nameField, domain: domainField })
  .strict();
export const updateProjectInput = z
  .object({
    projectId: z.string().min(1),
    name: nameField.optional(),
    domain: domainField.optional(),
    auditWeekly: z.boolean().optional(),
  })
  .strict();
export const projectIdInput = z.object({ projectId: z.string().min(1) }).strict();

/** The project when the user owns it or is an admin; otherwise "not found". */
export async function projectFor(
  user: EveryAppUser,
  projectId: string,
): Promise<Project> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!project || (project.ownerId !== user.id && !isAdmin(user))) notFound();
  return project;
}

export async function createProject(
  user: EveryAppUser,
  input: z.infer<typeof createProjectInput>,
): Promise<Project> {
  const [project] = await db
    .insert(projects)
    .values({ id: crypto.randomUUID(), ownerId: user.id, ...input })
    .returning();
  return project!;
}

export async function updateProject(
  user: EveryAppUser,
  { projectId, ...change }: z.infer<typeof updateProjectInput>,
): Promise<Project> {
  await projectFor(user, projectId);
  if (Object.keys(change).length === 0) {
    throw new UserFacingError("Nothing to change");
  }
  const [project] = await db
    .update(projects)
    .set(change)
    .where(eq(projects.id, projectId))
    .returning();
  return project!;
}

/** Deletes the project and everything under it in one batch. */
export async function deleteProject(
  user: EveryAppUser,
  projectId: string,
): Promise<void> {
  await projectFor(user, projectId);
  await db.batch([
    db.delete(savedKeywords).where(eq(savedKeywords.projectId, projectId)),
    db.delete(keywordLists).where(eq(keywordLists.projectId, projectId)),
    db.delete(rankResults).where(eq(rankResults.projectId, projectId)),
    db.delete(rankRuns).where(eq(rankRuns.projectId, projectId)),
    db.delete(trackedKeywords).where(eq(trackedKeywords.projectId, projectId)),
    db.delete(competitors).where(eq(competitors.projectId, projectId)),
    db.delete(auditIssues).where(eq(auditIssues.projectId, projectId)),
    db.delete(auditPages).where(eq(auditPages.projectId, projectId)),
    db.delete(audits).where(eq(audits.projectId, projectId)),
    db.delete(projects).where(eq(projects.id, projectId)),
  ]);
}

export interface ProjectSummary {
  id: string;
  name: string;
  domain: string;
  keywords: number;
  visibility: number | null;
  auditScore: number | null;
  auditStatus: string | null;
  ownerEmail?: string;
}

/** Each project with its tracking and audit summary. */
async function summarize(rows: Project[]): Promise<ProjectSummary[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((p) => p.id);
  const [counts, lastAudits, visibility] = await Promise.all([
    db
      .select({ projectId: trackedKeywords.projectId, n: sql<number>`count(*)` })
      .from(trackedKeywords)
      .where(inArray(trackedKeywords.projectId, ids))
      .groupBy(trackedKeywords.projectId),
    db
      .select({
        projectId: audits.projectId,
        score: audits.score,
        status: audits.status,
        createdAt: audits.createdAt,
      })
      .from(audits)
      .where(inArray(audits.projectId, ids))
      .orderBy(desc(audits.createdAt)),
    latestVisibility(rows),
  ]);
  return rows.map((p) => {
    const audit = lastAudits.find((a) => a.projectId === p.id);
    const lastDone = lastAudits.find(
      (a) => a.projectId === p.id && a.status === "done",
    );
    return {
      id: p.id,
      name: p.name,
      domain: p.domain,
      keywords: counts.find((c) => c.projectId === p.id)?.n ?? 0,
      visibility: visibility.get(p.id) ?? null,
      auditScore: lastDone?.score ?? null,
      auditStatus: audit?.status ?? null,
    };
  });
}

async function latestVisibility(rows: Project[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const p of rows) {
    const [run] = await db
      .select({ id: rankRuns.id })
      .from(rankRuns)
      .where(and(eq(rankRuns.projectId, p.id), eq(rankRuns.status, "done")))
      .orderBy(desc(rankRuns.createdAt))
      .limit(1);
    if (!run) continue;
    const results = await db
      .select({ position: rankResults.position })
      .from(rankResults)
      .where(
        and(eq(rankResults.runId, run.id), eq(rankResults.domain, p.domain)),
      );
    out.set(p.id, visibilityOf(results.map((r) => r.position)));
  }
  return out;
}

export async function listProjects(
  user: EveryAppUser,
): Promise<ProjectSummary[]> {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, user.id))
    .orderBy(projects.name);
  return summarize(rows);
}

/** Every project in the workspace, with its owner: admins only. */
export async function listAllProjects(
  user: EveryAppUser,
): Promise<ProjectSummary[]> {
  if (!isAdmin(user)) {
    throw new UserFacingError("Only workspace admins can open this page.");
  }
  const rows = await db.select().from(projects).orderBy(projects.name);
  const owners = await db.select().from(users);
  return (await summarize(rows)).map((s, i) => ({
    ...s,
    ownerEmail: owners.find((u) => u.id === rows[i]!.ownerId)?.email ?? "",
  }));
}
