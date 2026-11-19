import { env } from "cloudflare:workers";
import type { EveryAppUser } from "@every-app/sdk/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chunks } from "@/db/chunks";
import { competitors, projects, rankResults, rankRuns, trackedKeywords } from "@/db/schema";
import { DOMAIN_ERROR, normalizeDomain } from "@/shared/domain";
import { LOCATIONS, featureName } from "@/shared/locations";
import { visibilityOf } from "@/shared/visibility";
import { UserFacingError } from "@/server/errors";
import { projectFor, type Project } from "@/server/projects";
import { NOT_SET_UP, searchDataReady } from "@/server/searchData";

export const MAX_TRACKED = 500;
export const MAX_COMPETITORS = 20;

export const trackInput = z
  .object({
    projectId: z.string().min(1),
    keywords: z.array(z.string().trim().toLowerCase().max(200)).max(MAX_TRACKED),
    location: z
      .number()
      .int()
      .refine((c) => LOCATIONS.some((l) => l.code === c), "Pick a location"),
    device: z.enum(["desktop", "mobile"]),
  })
  .strict();
export const removeTrackedInput = z
  .object({ projectId: z.string().min(1), id: z.string().min(1) })
  .strict();
export const competitorInput = z
  .object({
    projectId: z.string().min(1),
    domain: z.string().transform((value, ctx) => {
      const host = normalizeDomain(value);
      if (!host) {
        ctx.addIssue({ code: "custom", message: DOMAIN_ERROR });
        return z.NEVER;
      }
      return host;
    }),
  })
  .strict();

export async function trackKeywords(
  user: EveryAppUser,
  input: z.infer<typeof trackInput>,
): Promise<{ added: number }> {
  const project = await projectFor(user, input.projectId);
  const keywords = [...new Set(input.keywords.filter(Boolean))];
  if (keywords.length === 0) throw new UserFacingError("Enter at least one keyword");
  const existing = await db
    .select({ keyword: trackedKeywords.keyword, location: trackedKeywords.locationCode, device: trackedKeywords.device })
    .from(trackedKeywords)
    .where(eq(trackedKeywords.projectId, project.id));
  const fresh = keywords.filter(
    (k) => !existing.some((e) => e.keyword === k && e.location === input.location && e.device === input.device),
  );
  if (existing.length + fresh.length > MAX_TRACKED) {
    throw new UserFacingError(
      `A project tracks up to ${MAX_TRACKED} keywords; ${MAX_TRACKED - existing.length} more fit.`,
    );
  }
  if (fresh.length === 0) return { added: 0 };
  const rows = fresh.map((keyword) => ({
    id: crypto.randomUUID(),
    projectId: project.id,
    keyword,
    locationCode: input.location,
    device: input.device,
  }));
  const [first, ...rest] = chunks(rows, 6).map((part) =>
    db.insert(trackedKeywords).values(part).onConflictDoNothing(),
  );
  await db.batch([first!, ...rest]);
  return { added: fresh.length };
}

export async function stopTracking(
  user: EveryAppUser,
  input: z.infer<typeof removeTrackedInput>,
): Promise<void> {
  const project = await projectFor(user, input.projectId);
  await db.batch([
    db
      .delete(rankResults)
      .where(and(eq(rankResults.trackedKeywordId, input.id), eq(rankResults.projectId, project.id))),
    db
      .delete(trackedKeywords)
      .where(and(eq(trackedKeywords.id, input.id), eq(trackedKeywords.projectId, project.id))),
  ]);
}

export async function addCompetitor(
  user: EveryAppUser,
  input: z.infer<typeof competitorInput>,
): Promise<void> {
  const project = await projectFor(user, input.projectId);
  if (input.domain === project.domain) {
    throw new UserFacingError("That's this project's own domain");
  }
  const [{ n }] = (await db
    .select({ n: sql<number>`count(*)` })
    .from(competitors)
    .where(eq(competitors.projectId, project.id))) as [{ n: number }];
  if (n >= MAX_COMPETITORS) {
    throw new UserFacingError(`A project follows up to ${MAX_COMPETITORS} competitors`);
  }
  await db
    .insert(competitors)
    .values({ id: crypto.randomUUID(), projectId: project.id, domain: input.domain })
    .onConflictDoNothing();
}

export async function removeCompetitor(
  user: EveryAppUser,
  input: z.infer<typeof removeTrackedInput>,
): Promise<void> {
  const project = await projectFor(user, input.projectId);
  await db
    .delete(competitors)
    .where(and(eq(competitors.id, input.id), eq(competitors.projectId, project.id)));
}

/** A run that hasn't finished in this long is treated as stuck. */
const STUCK_MS = 30 * 60 * 1000;

async function runningCheck(projectId: string) {
  const [run] = await db
    .select()
    .from(rankRuns)
    .where(and(eq(rankRuns.projectId, projectId), eq(rankRuns.status, "running")))
    .orderBy(desc(rankRuns.createdAt))
    .limit(1);
  if (run && Date.now() - Date.parse(run.createdAt) < STUCK_MS) return run;
  return null;
}

/** Starts a check of every tracked keyword, unless one is already running. */
export async function startRankCheck(project: Project): Promise<string | null> {
  if (await runningCheck(project.id)) return null;
  const [{ n }] = (await db
    .select({ n: sql<number>`count(*)` })
    .from(trackedKeywords)
    .where(eq(trackedKeywords.projectId, project.id))) as [{ n: number }];
  if (n === 0) return null;
  const runId = crypto.randomUUID();
  await db.insert(rankRuns).values({ id: runId, projectId: project.id, status: "running" });
  await env.RANK_CHECK.create({ id: runId, params: { projectId: project.id, runId } });
  return runId;
}

export async function checkNow(user: EveryAppUser, projectId: string): Promise<void> {
  const project = await projectFor(user, projectId);
  if (!(await searchDataReady())) throw new UserFacingError(NOT_SET_UP);
  if (await runningCheck(project.id)) throw new UserFacingError("A check is already running");
  if (!(await startRankCheck(project))) throw new UserFacingError("Add keywords to track first");
}

/** The daily check of every project that tracks keywords. */
export async function scheduledRankChecks(): Promise<void> {
  if (!(await searchDataReady(true))) return;
  const rows = await db
    .select()
    .from(projects)
    .where(inArray(projects.id, db.selectDistinct({ id: trackedKeywords.projectId }).from(trackedKeywords)));
  for (const project of rows) await startRankCheck(project);
}

export interface TrackingView {
  ready: boolean;
  domain: string;
  status: { state: "never" | "running" | "done" | "failed"; at: string | null; error: string | null };
  visibility: number | null;
  keywords: {
    id: string;
    keyword: string;
    location: number;
    device: "desktop" | "mobile";
    position: number | null;
    change: number | null;
    url: string | null;
    features: string[];
    owned: string[];
    checked: boolean;
  }[];
  competitors: { id: string; domain: string }[];
  /** Positions per keyword for the project and each competitor, from the last run. */
  comparison: { keyword: string; positions: (number | null)[] }[];
  /** Visibility per finished run, oldest first: the project's then each competitor's. */
  history: { at: string; values: number[] }[];
}

const matches = (host: string | null | undefined, domain: string) =>
  !!host && (host === domain || host.endsWith(`.${domain}`));
export { matches as hostMatches };

export async function trackingView(user: EveryAppUser, projectId: string): Promise<TrackingView> {
  const project = await projectFor(user, projectId);
  const [keywords, rivals, runs, ready] = await Promise.all([
    db.select().from(trackedKeywords).where(eq(trackedKeywords.projectId, project.id)).orderBy(trackedKeywords.createdAt, trackedKeywords.keyword),
    db.select({ id: competitors.id, domain: competitors.domain }).from(competitors).where(eq(competitors.projectId, project.id)).orderBy(competitors.createdAt),
    db.select().from(rankRuns).where(eq(rankRuns.projectId, project.id)).orderBy(desc(rankRuns.createdAt)).limit(60),
    searchDataReady(),
  ]);
  const done = runs.filter((r) => r.status === "done");
  const results = done.length
    ? await db.select().from(rankResults).where(and(eq(rankResults.projectId, project.id), inArray(rankResults.runId, done.map((r) => r.id))))
    : [];
  const at = (runId: string | undefined, keywordId: string, domain: string) =>
    runId ? results.find((r) => r.runId === runId && r.trackedKeywordId === keywordId && r.domain === domain) : undefined;

  const view = keywords.map((k) => {
    // The latest and previous runs that checked this keyword.
    const own = done.flatMap((run) => {
      const r = at(run.id, k.id, project.domain);
      return r ? [r] : [];
    });
    const [latest, previous] = own;
    const change =
      latest && previous && latest.position !== null && previous.position !== null
        ? previous.position - latest.position
        : null;
    return {
      id: k.id,
      keyword: k.keyword,
      location: k.locationCode,
      device: k.device,
      position: latest?.position ?? null,
      change,
      url: latest?.url ?? null,
      features: (latest?.serpFeatures ?? []).map(featureName),
      owned: (latest?.ownedFeatures ?? []).map(featureName),
      checked: !!latest,
    };
  });

  const domains = [project.domain, ...rivals.map((c) => c.domain)];
  const last = done[0];
  const history = [...done].reverse().map((run) => ({
    at: run.finishedAt ?? run.createdAt,
    values: domains.map((d) =>
      visibilityOf(results.filter((r) => r.runId === run.id && r.domain === d).map((r) => r.position)),
    ),
  }));
  const current = runs[0];
  return {
    ready,
    domain: project.domain,
    status: current
      ? {
          state: current.status === "running" && Date.now() - Date.parse(current.createdAt) >= STUCK_MS ? "failed" : current.status,
          at: current.finishedAt ?? current.createdAt,
          error: current.error,
        }
      : { state: "never", at: null, error: null },
    visibility: last ? history.at(-1)!.values[0]! : null,
    keywords: view,
    competitors: rivals,
    comparison: keywords.map((k) => ({
      keyword: k.keyword,
      positions: domains.map((d) => at(last?.id, k.id, d)?.position ?? null),
    })),
    history,
  };
}
