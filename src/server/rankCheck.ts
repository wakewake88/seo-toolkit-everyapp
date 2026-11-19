import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chunks } from "@/db/chunks";
import { competitors, projects, rankResults, rankRuns, trackedKeywords } from "@/db/schema";
import { defaultLanguage } from "@/shared/locations";
import { liveSerp } from "@/server/research";
import { hostMatches } from "@/server/tracking";

interface Params {
  projectId: string;
  runId: string;
}

/** Checks one keyword's top 100 and records each domain's position. */
async function checkKeyword(runId: string, projectId: string, keywordId: string): Promise<void> {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  const [keyword] = await db
    .select()
    .from(trackedKeywords)
    .where(and(eq(trackedKeywords.id, keywordId), eq(trackedKeywords.projectId, projectId)));
  if (!project || !keyword) return;
  const rivals = await db.select().from(competitors).where(eq(competitors.projectId, projectId));
  const page = await liveSerp({
    keyword: keyword.keyword,
    location: keyword.locationCode,
    language: defaultLanguage(keyword.locationCode),
    device: keyword.device,
    depth: 100,
    background: true,
  });
  const features = (page.item_types ?? []).filter((t) => t !== "organic");
  const rows = [project.domain, ...rivals.map((c) => c.domain)].map((domain) => {
    const organic = page.items.find(
      (i) => i.type === "organic" && hostMatches(i.domain ?? hostOf(i.url), domain),
    );
    const owned = [
      ...new Set(
        page.items
          .filter((i) => i.type !== "organic" && hostMatches(i.domain ?? hostOf(i.url), domain))
          .map((i) => i.type),
      ),
    ];
    return {
      id: crypto.randomUUID(),
      projectId,
      runId,
      trackedKeywordId: keyword.id,
      domain,
      position: organic?.rank_group && organic.rank_group <= 100 ? organic.rank_group : null,
      url: organic?.url ?? null,
      serpFeatures: features,
      ownedFeatures: owned,
    };
  });
  const [first, ...rest] = chunks(rows, 10).map((part) =>
    db.insert(rankResults).values(part).onConflictDoNothing(),
  );
  await db.batch([first!, ...rest]);
}

function hostOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

export class RankCheckWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { projectId, runId } = event.payload;
    try {
      const ids = await step.do("keywords", async () =>
        (
          await db
            .select({ id: trackedKeywords.id })
            .from(trackedKeywords)
            .where(eq(trackedKeywords.projectId, projectId))
            .orderBy(trackedKeywords.createdAt, trackedKeywords.keyword)
        ).map((k) => k.id),
      );
      for (const id of ids) {
        await step.do(
          `keyword ${id}`,
          { retries: { limit: 2, delay: "10 seconds", backoff: "linear" } },
          () => checkKeyword(runId, projectId, id),
        );
      }
      await step.do("finish", () => finish(runId, "done", null));
    } catch (error) {
      const message = error instanceof Error ? error.message : "The check failed";
      await step.do("fail", () => finish(runId, "failed", message));
    }
  }
}

async function finish(runId: string, status: "done" | "failed", error: string | null) {
  await db
    .update(rankRuns)
    .set({ status, error, finishedAt: new Date().toISOString() })
    .where(eq(rankRuns.id, runId));
}
