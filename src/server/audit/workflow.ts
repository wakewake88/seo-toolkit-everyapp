import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chunks } from "@/db/chunks";
import { auditIssues, auditPages, audits, projects } from "@/db/schema";
import { CRAWLER_NAME, RULES, blockedAiCrawlers, healthScore, parseRobots, robotsAllows } from "@/shared/auditRules";
import { crawlPage, crawlerFetch, type CrawledPage } from "@/server/audit/crawl";
import { findings } from "@/server/audit/findings";

interface Params {
  auditId: string;
  projectId: string;
}

const BATCH = 10;

class AuditFailure extends NonRetryableError {}

export class SiteAuditWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { auditId, projectId } = event.payload;
    try {
      const setup = await step.do("robots", async () => {
        const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
        const [audit] = await db.select().from(audits).where(eq(audits.id, auditId));
        if (!project || !audit) throw new AuditFailure("The project was deleted");
        await db.update(audits).set({ status: "running" }).where(eq(audits.id, auditId));
        const root = `https://${project.domain}/`;
        let robots = "";
        try {
          const response = await crawlerFetch(`https://${project.domain}/robots.txt`);
          if (response.ok) robots = (await response.text()).slice(0, 500_000);
          else await response.body?.cancel();
        } catch {
          // No robots.txt reachable: everything is allowed.
        }
        return { domain: project.domain, root, robots, limit: audit.pageLimit };
      });
      const groups = parseRobots(setup.robots);
      const pages: CrawledPage[] = [];
      const seen = new Set<string>([setup.root]);
      const queue: string[] = [setup.root];
      let batch = 0;
      while (queue.length && pages.length < setup.limit) {
        const take = queue.splice(0, Math.min(BATCH, setup.limit - pages.length));
        const crawled = await step.do(`crawl ${batch++}`, { retries: { limit: 1, delay: "5 seconds" } }, async () => {
          const results: CrawledPage[] = [];
          for (const url of take) {
            const { pathname, search } = new URL(url);
            if (!robotsAllows(groups, CRAWLER_NAME, pathname + search)) continue;
            try {
              results.push(await crawlPage(url, setup.domain));
            } catch (error) {
              if (url === setup.root) {
                throw new AuditFailure(`Couldn't reach ${setup.domain}: ${error instanceof Error ? error.message : "no answer"}`);
              }
              results.push({ ...emptyPage(url), status: 599 });
            }
          }
          const rows = results.map((p) => ({
            id: crypto.randomUUID(),
            projectId,
            auditId,
            url: p.url,
            status: p.status,
            title: p.title,
          }));
          const writes = chunks(rows, 7).map((part) => db.insert(auditPages).values(part).onConflictDoNothing());
          const [first, ...rest] = [
            db.update(audits).set({ pagesCrawled: pages.length + results.length }).where(eq(audits.id, auditId)),
            ...writes,
          ];
          await db.batch([first, ...rest]);
          return results;
        });
        for (const page of crawled) {
          pages.push(page);
          for (const link of [...page.links, ...(page.finalUrl ? [page.finalUrl] : [])]) {
            if (seen.has(link)) continue;
            seen.add(link);
            queue.push(link);
          }
        }
      }
      await step.do("score", async () => {
        if (pages.length === 0) throw new AuditFailure(`robots.txt keeps the crawler off ${setup.domain}`);
        const found = findings(pages, `https://${setup.domain}/robots.txt`, blockedAiCrawlers(groups));
        const score = healthScore(
          pages.length,
          found.map((f) => ({ url: f.url, severity: RULES[f.rule].severity })),
        );
        const counts = new Map<string, number>();
        for (const f of found) counts.set(f.url, (counts.get(f.url) ?? 0) + 1);
        const issueRows = found.map((f) => ({ id: crypto.randomUUID(), projectId, auditId, ...f }));
        const updates = [...counts].map(([url, n]) =>
          db.update(auditPages).set({ issueCount: n }).where(eqPage(auditId, url)),
        );
        await db.batch([
          db.update(audits).set({ status: "done", score, pagesCrawled: pages.length, finishedAt: new Date().toISOString() }).where(eq(audits.id, auditId)),
          ...chunks(issueRows, 6).map((part) => db.insert(auditIssues).values(part)),
          ...updates,
        ]);
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message.replace(/^.*?AuditFailure: /, "") : "The audit stopped";
      await step.do("fail", async () => {
        await db.update(audits).set({ status: "failed", error: message, finishedAt: new Date().toISOString() }).where(eq(audits.id, auditId));
      });
    }
  }
}

function eqPage(auditId: string, url: string) {
  return and(eq(auditPages.auditId, auditId), eq(auditPages.url, url));
}

function emptyPage(url: string): CrawledPage {
  return {
    url,
    status: 0,
    redirects: [],
    finalUrl: null,
    html: false,
    bytes: 0,
    title: null,
    description: null,
    h1: 0,
    imagesWithoutAlt: 0,
    noindex: false,
    canonical: null,
    links: [],
    httpLinks: [],
  };
}
