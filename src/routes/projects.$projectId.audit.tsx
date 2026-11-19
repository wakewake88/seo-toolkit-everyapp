import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Choice } from "@/client/components/Choice";
import { EmptyState } from "@/client/components/EmptyState";
import { Stat } from "@/client/components/Stat";
import { TrendChart } from "@/client/components/TrendChart";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Label } from "@/client/components/ui/label";
import { Switch } from "@/client/components/ui/switch";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { day, messageOf, when } from "@/client/lib/format";
import { PAGE_LIMITS, type Severity } from "@/shared/auditRules";
import { getAudit, startAudit } from "@/serverFunctions/audits";
import { updateProject } from "@/serverFunctions/projects";

export const Route = createFileRoute("/projects/$projectId/audit")({
  validateSearch: z.object({ audit: z.string().optional() }),
  loaderDeps: ({ search }) => ({ audit: search.audit }),
  loader: ({ params, deps }) =>
    getAudit({ data: { projectId: params.projectId, auditId: deps.audit } }),
  component: Audit,
});

const LIMIT_ITEMS = PAGE_LIMITS.map((n) => ({ value: n, label: `${n} pages` }));
const SEVERITY: Record<Severity, { label: string; variant: "destructive" | "warning" | "info" }> = {
  error: { label: "Error", variant: "destructive" },
  warning: { label: "Warning", variant: "warning" },
  notice: { label: "Notice", variant: "info" },
};

function Audit() {
  const view = Route.useLoaderData();
  const { projectId } = Route.useParams();
  const router = useRouter();
  const [limit, setLimit] = useState<number>(100);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const audit = view.audit;
  const active = !!audit && (audit.status === "queued" || audit.status === "running") && !audit.stuck;
  const latestActive = view.history[0] && (view.history[0].status === "queued" || view.history[0].status === "running");

  useEffect(() => {
    if (!latestActive) return;
    const timer = setInterval(() => void router.invalidate(), 3000);
    return () => clearInterval(timer);
  }, [latestActive, router]);

  async function start() {
    setPending(true);
    try {
      await startAudit({ data: { projectId, pageLimit: limit } });
      await router.navigate({ to: "/projects/$projectId/audit", params: { projectId }, search: {} });
      await router.invalidate();
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setPending(false);
    }
  }

  async function setWeekly(auditWeekly: boolean) {
    try {
      await updateProject({ data: { projectId, auditWeekly } });
      await router.invalidate();
    } catch (error) {
      toast.error(messageOf(error));
    }
  }

  const trend = [...view.history]
    .reverse()
    .filter((h) => h.status === "done" && h.score !== null)
    .map((h) => ({ label: day(h.at), score: h.score as number }));

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <Choice id="page-limit" label="Pages to crawl" value={limit} onChange={setLimit} items={LIMIT_ITEMS} className="w-40 space-y-1.5" />
            <Button onClick={start} pending={pending} disabled={pending || !!latestActive}>
              Start audit
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="weekly" checked={view.weekly} onCheckedChange={(v) => void setWeekly(v)} />
            <Label htmlFor="weekly">Rerun weekly</Label>
          </div>
        </CardContent>
      </Card>

      {!audit ? (
        <EmptyState title="No audits yet" description="Start one to check every page of the site." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span data-testid="audit-status" className={audit.status === "failed" ? "text-destructive" : "font-medium"}>
              {audit.stuck
                ? "Failed: the crawl stopped responding"
                : audit.status === "queued"
                  ? "Queued"
                  : audit.status === "running"
                    ? `Running · ${audit.pagesCrawled} pages crawled`
                    : audit.status === "done"
                      ? "Done"
                      : `Failed: ${audit.error ?? "the crawl stopped"}`}
            </span>
            <span className="text-muted-foreground">
              · {when(audit.at)} · up to {audit.pageLimit} pages
            </span>
          </div>

          {audit.status === "done" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label="Site health" testId="health-score" value={audit.score ?? 0} />
                <Stat label="Errors" value={audit.counts.error} />
                <Stat label="Warnings" value={audit.counts.warning} />
                <Stat label="Notices" value={audit.counts.notice} />
              </div>

              <section className="space-y-3">
                <h2 className="text-base font-semibold tracking-tight">Issues</h2>
                {audit.issues.length === 0 ? (
                  <EmptyState title="No issues found" variant="plain" />
                ) : (
                  <TableCard>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Issue</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead className="text-right">Pages</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {audit.issues.map((issue) => (
                          <IssueRow
                            key={issue.rule}
                            issue={issue}
                            open={open === issue.rule}
                            onToggle={() => setOpen(open === issue.rule ? null : issue.rule)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </TableCard>
                )}
              </section>
            </>
          ) : null}

          {audit.pages.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-base font-semibold tracking-tight">Crawled pages</h2>
              <TableCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                      <TableHead className="text-right">Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit.pages.map((page) => (
                      <TableRow key={page.url} data-testid="page-row">
                        <TableCell className="max-w-80 truncate">{page.url.replace(/^https:\/\//, "")}</TableCell>
                        <TableCell className="max-w-64 truncate text-muted-foreground">{page.title ?? "–"}</TableCell>
                        <TableCell className="text-right tabular-nums">{page.status || "–"}</TableCell>
                        <TableCell className="text-right tabular-nums">{page.issues}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            </section>
          ) : null}
        </>
      )}

      {view.history.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">Past audits</h2>
          {trend.length > 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>Site health over time</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart points={trend} max={100} series={[{ key: "score", label: "Site health" }]} />
              </CardContent>
            </Card>
          ) : null}
          <TableCard>
            <Table>
              <TableBody>
                {view.history.map((h) => (
                  <TableRow key={h.id} data-testid="audit-history-row">
                    <TableCell>
                      <Link
                        to="/projects/$projectId/audit"
                        params={{ projectId }}
                        search={{ audit: h.id }}
                        className="hover:underline"
                      >
                        {when(h.at)}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{h.status === "done" ? `${h.pages} pages` : h.status}</TableCell>
                    <TableCell className="text-right tabular-nums">{h.score ?? "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        </section>
      ) : null}
    </div>
  );
}

function IssueRow({
  issue,
  open,
  onToggle,
}: {
  issue: {
    rule: string;
    title: string;
    severity: Severity;
    category: string;
    tip: string;
    count: number;
    pages: { url: string; detail: string | null }[];
  };
  open: boolean;
  onToggle: () => void;
}) {
  const severity = SEVERITY[issue.severity];
  return (
    <>
      <TableRow data-testid="issue-row">
        <TableCell>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="inline-flex cursor-pointer items-center gap-1 text-left font-medium hover:underline"
          >
            {open ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
            {issue.title}
          </button>
        </TableCell>
        <TableCell className="text-muted-foreground">{issue.category}</TableCell>
        <TableCell>
          <Badge variant={severity.variant}>{severity.label}</Badge>
        </TableCell>
        <TableCell className="text-right tabular-nums">{issue.count}</TableCell>
      </TableRow>
      {open ? (
        <TableRow>
          <TableCell colSpan={4} className="space-y-2 bg-muted/40 whitespace-normal">
            <p className="text-sm">{issue.tip}</p>
            <ul className="space-y-1 text-sm">
              {issue.pages.map((p) => (
                <li key={p.url + (p.detail ?? "")} data-testid="affected-page" className="break-all">
                  {p.url.replace(/^https:\/\//, "")}
                  {p.detail ? <span className="text-muted-foreground"> · {p.detail}</span> : null}
                </li>
              ))}
            </ul>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
