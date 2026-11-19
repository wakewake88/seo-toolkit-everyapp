import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Choice } from "@/client/components/Choice";
import { CompetitorFields } from "@/client/components/CompetitorFields";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { SaveToListDialog } from "@/client/components/SaveToList";
import { SearchDataOff } from "@/client/components/SearchDataOff";
import { Shell } from "@/client/components/Shell";
import { Stat } from "@/client/components/Stat";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { count, messageOf } from "@/client/lib/format";
import { DEFAULT_LOCATION, LOCATIONS } from "@/shared/locations";
import { getProjects } from "@/serverFunctions/projects";
import { getDomainOverview, getKeywordGap, getSearchDataStatus } from "@/serverFunctions/research";

export const Route = createFileRoute("/domains")({
  loader: async () => {
    const [status, { projects }] = await Promise.all([getSearchDataStatus(), getProjects()]);
    return { ready: status.ready, projects: projects.map((p) => ({ id: p.id, name: p.name, domain: p.domain })) };
  },
  head: () => ({ meta: [{ title: "Domains · SEO Toolkit" }] }),
  component: Domains,
});

const LOCATION_ITEMS = LOCATIONS.map((l) => ({ value: l.code, label: l.name }));

function Domains() {
  const { ready } = Route.useLoaderData();
  return (
    <Shell>
      <PageHeader title="Domains" />
      {!ready ? <SearchDataOff /> : null}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="gap">Keyword gap</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6">
          <Overview ready={ready} />
        </TabsContent>
        <TabsContent value="gap" className="space-y-6">
          <Gap ready={ready} />
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function Overview({ ready }: { ready: boolean }) {
  const [domain, setDomain] = useState("");
  const [location, setLocation] = useState<number>(DEFAULT_LOCATION);
  const [data, setData] = useState<Awaited<ReturnType<typeof getDomainOverview>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      setData(await getDomainOverview({ data: { domain, location } }));
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (domain.trim()) void analyze();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="overview-domain">Domain</Label>
              <Input id="overview-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
            </div>
            <Choice id="overview-location" label="Location" value={location} onChange={setLocation} items={LOCATION_ITEMS} />
            <Button type="submit" disabled={!ready} pending={loading}>
              Analyze
            </Button>
          </form>
        </CardContent>
      </Card>
      {error ? <EmptyState kind="error" title={error} /> : null}
      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Ranking keywords" testId="ranking-keywords" value={count(data.rankingKeywords)} />
            <Stat label="Organic traffic per month" testId="organic-traffic" value={count(data.traffic)} />
          </div>
          <section className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight">Top keywords</h2>
            {data.topKeywords.length === 0 ? (
              <EmptyState title="No ranking keywords in this location" variant="plain" />
            ) : (
              <TableCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Keyword</TableHead>
                      <TableHead className="text-right">Position</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead>URL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topKeywords.map((k) => (
                      <TableRow key={k.keyword} data-testid="top-keyword-row">
                        <TableCell className="font-medium">{k.keyword}</TableCell>
                        <TableCell className="text-right tabular-nums">{k.position}</TableCell>
                        <TableCell className="text-right tabular-nums">{count(k.volume)}</TableCell>
                        <TableCell className="max-w-72 truncate">
                          <a href={k.url} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">
                            {k.url.replace(/^https?:\/\//, "")}
                          </a>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            )}
          </section>
          <section className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight">Organic competitors</h2>
            {data.competitors.length === 0 ? (
              <EmptyState title="No competitors found" variant="plain" />
            ) : (
              <TableCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead className="text-right">Shared keywords</TableHead>
                      <TableHead className="text-right">Their keywords</TableHead>
                      <TableHead className="text-right">Their traffic</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.competitors.map((c) => (
                      <TableRow key={c.domain} data-testid="competitor-row">
                        <TableCell className="font-medium">{c.domain}</TableCell>
                        <TableCell className="text-right tabular-nums">{count(c.overlap)}</TableCell>
                        <TableCell className="text-right tabular-nums">{count(c.keywords)}</TableCell>
                        <TableCell className="text-right tabular-nums">{count(c.traffic)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}

type GapData = Awaited<ReturnType<typeof getKeywordGap>>;

function Gap({ ready }: { ready: boolean }) {
  const { projects } = Route.useLoaderData();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [location, setLocation] = useState<number>(DEFAULT_LOCATION);
  const [rivals, setRivals] = useState(["", "", "", ""]);
  const [data, setData] = useState<GapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"missing" | "weaker" | "shared">("missing");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  if (projects.length === 0) {
    return <EmptyState title="No projects yet" description="Create a project to compare its keywords with competitors." />;
  }

  async function compare() {
    setLoading(true);
    setError(null);
    try {
      setData(await getKeywordGap({ data: { projectId, location, competitors: rivals.filter((r) => r.trim()) } }));
      setSelected(new Set());
      setView("missing");
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }

  const rows = data ? data.rows.filter((r) => (view === "shared" ? r.own !== null : r.kind === view)) : [];
  const tally = (kind: typeof view) => (data ? data.rows.filter((r) => (kind === "shared" ? r.own !== null : r.kind === kind)).length : 0);
  const picked = (data?.rows ?? [])
    .filter((r) => selected.has(r.keyword))
    .map((r) => ({ keyword: r.keyword, volume: r.volume, difficulty: null, cpc: null, intent: null }));

  return (
    <>
      <Card>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void compare();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice
                id="gap-project"
                label="Project"
                value={projectId}
                onChange={setProjectId}
                items={projects.map((p) => ({ value: p.id, label: `${p.name} (${p.domain})` }))}
              />
              <Choice id="gap-location" label="Location" value={location} onChange={setLocation} items={LOCATION_ITEMS} />
            </div>
            <CompetitorFields values={rivals} onChange={setRivals} />
            <Button type="submit" disabled={!ready || !rivals.some((r) => r.trim())} pending={loading}>
              Compare
            </Button>
          </form>
        </CardContent>
      </Card>
      {error ? <EmptyState kind="error" title={error} /> : null}
      {data ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
              <TabsList>
                <TabsTrigger value="missing">Missing ({tally("missing")})</TabsTrigger>
                <TabsTrigger value="weaker">Weaker ({tally("weaker")})</TabsTrigger>
                <TabsTrigger value="shared">Shared ({tally("shared")})</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" disabled={picked.length === 0} onClick={() => setSaving(true)}>
              Save to list{picked.length ? ` (${picked.length})` : ""}
            </Button>
          </div>
          {rows.length === 0 ? (
            <EmptyState title="No keywords here" variant="plain" />
          ) : (
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Keyword</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">{data.domain}</TableHead>
                    {data.competitors.map((c) => (
                      <TableHead key={c} className="text-right">
                        {c}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.keyword} data-testid="gap-row">
                      <TableCell>
                        <Checkbox
                          aria-label={`Select ${r.keyword}`}
                          checked={selected.has(r.keyword)}
                          onCheckedChange={(on) =>
                            setSelected((s) => {
                              const next = new Set(s);
                              if (on) next.add(r.keyword);
                              else next.delete(r.keyword);
                              return next;
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">{r.keyword}</TableCell>
                      <TableCell className="text-right tabular-nums">{count(r.volume)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.own ?? "–"}</TableCell>
                      {r.rivals.map((p, i) => (
                        <TableCell key={i} className="text-right tabular-nums">
                          {p ?? "–"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          )}
        </section>
      ) : null}
      {saving ? (
        <SaveToListDialog
          projects={projects}
          defaultProject={projectId}
          keywords={picked}
          onClose={() => setSaving(false)}
        />
      ) : null}
    </>
  );
}
