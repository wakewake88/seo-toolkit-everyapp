import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Link2, Unlink } from "lucide-react";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { CompetitorFields } from "@/client/components/CompetitorFields";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { SearchDataOff } from "@/client/components/SearchDataOff";
import { Shell } from "@/client/components/Shell";
import { Stat } from "@/client/components/Stat";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Spinner } from "@/client/components/ui/spinner";
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
import {
  getBacklinkGap,
  getBacklinkSummary,
  getBacklinks,
  getReferringDomains,
  getSearchDataStatus,
} from "@/serverFunctions/research";

export const Route = createFileRoute("/backlinks")({
  loader: () => getSearchDataStatus(),
  head: () => ({ meta: [{ title: "Backlinks · SEO Toolkit" }] }),
  component: Backlinks,
});

const PAGE = 50;
type Follow = "all" | "follow" | "nofollow";

function Backlinks() {
  const { ready } = Route.useLoaderData();
  const [domain, setDomain] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getBacklinkSummary>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      setSummary(await getBacklinkSummary({ data: { domain } }));
      setTarget(domain.trim());
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell>
      <PageHeader title="Backlinks" />
      {!ready ? <SearchDataOff /> : null}
      <Card>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (domain.trim()) void analyze();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="backlink-domain">Domain</Label>
              <Input id="backlink-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
            </div>
            <Button type="submit" disabled={!ready} pending={loading}>
              Analyze
            </Button>
          </form>
        </CardContent>
      </Card>
      {error ? <EmptyState kind="error" title={error} /> : null}
      {summary && target ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Backlinks" testId="total-backlinks" value={count(summary.backlinks)} />
            <Stat label="Referring domains" testId="referring-domains" value={count(summary.referringDomains)} />
            <Stat label="Authority rank" testId="authority-rank" value={count(summary.rank)} />
          </div>
          <Tabs defaultValue="links" className="space-y-4" key={target}>
            <TabsList>
              <TabsTrigger value="links">Backlinks</TabsTrigger>
              <TabsTrigger value="domains">Referring domains</TabsTrigger>
              <TabsTrigger value="gap">Backlink gap</TabsTrigger>
            </TabsList>
            <TabsContent value="links">
              <LinkList domain={target} />
            </TabsContent>
            <TabsContent value="domains">
              <Referrers domain={target} />
            </TabsContent>
            <TabsContent value="gap" className="space-y-4">
              <Gap domain={target} />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </Shell>
  );
}

function useLoad<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string } | null>(null);
  if (state?.key !== key) {
    const next = { key };
    setState(next);
    load().then(
      (data) => setState((s) => (s?.key === key ? { key, data } : s)),
      (error) => setState((s) => (s?.key === key ? { key, error: messageOf(error) } : s)),
    );
  }
  return state ?? { key };
}

function LinkList({ domain }: { domain: string }) {
  const [follow, setFollow] = useState<Follow>("all");
  const [page, setPage] = useState(1);
  const state = useLoad(() => getBacklinks({ data: { domain, follow, page } }), `${domain}|${follow}|${page}`);
  const total = state.data?.total ?? 0;
  const first = (page - 1) * PAGE + 1;
  const last = Math.min(total, page * PAGE);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedToggle
          showLabels
          value={follow}
          onChange={(next) => {
            setFollow(next);
            setPage(1);
          }}
          items={[
            { value: "all", label: "All", icon: <Link2 aria-hidden /> },
            { value: "follow", label: "Follow", icon: <Link2 aria-hidden /> },
            { value: "nofollow", label: "Nofollow", icon: <Unlink aria-hidden /> },
          ]}
        />
        {state.data ? (
          <div className="flex items-center gap-2 text-sm">
            <span data-testid="backlink-page" className="text-muted-foreground tabular-nums">
              {total === 0 ? "0" : `${first}–${last} of ${count(total)}`}
            </span>
            <Button variant="outline" size="sm" aria-label="Previous page" disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" aria-label="Next page" disabled={last >= total} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        ) : null}
      </div>
      {state.error ? (
        <EmptyState kind="error" title={state.error} />
      ) : !state.data ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : state.data.rows.length === 0 ? (
        <EmptyState title="No backlinks found" variant="plain" />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Anchor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>First seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.data.rows.map((link, i) => (
                <TableRow key={link.source + link.target + i} data-testid="backlink-row">
                  <TableCell className="max-w-72 truncate">
                    <a href={link.source} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">
                      {link.source.replace(/^https?:\/\//, "")}
                    </a>
                  </TableCell>
                  <TableCell className="max-w-48 truncate">{link.anchor || "–"}</TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">{link.target.replace(/^https?:\/\//, "")}</TableCell>
                  <TableCell>
                    <Badge variant={link.follow ? "secondary" : "outline"}>{link.follow ? "follow" : "nofollow"}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{link.firstSeen ?? "–"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
    </div>
  );
}

function Referrers({ domain }: { domain: string }) {
  const state = useLoad(() => getReferringDomains({ data: { domain } }), domain);
  if (state.error) return <EmptyState kind="error" title={state.error} />;
  if (!state.data) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }
  if (state.data.length === 0) return <EmptyState title="No referring domains found" variant="plain" />;
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Domain</TableHead>
            <TableHead className="text-right">Rank</TableHead>
            <TableHead className="text-right">Backlinks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.data.map((r) => (
            <TableRow key={r.domain} data-testid="referring-row">
              <TableCell className="font-medium">{r.domain}</TableCell>
              <TableCell className="text-right tabular-nums">{count(r.rank)}</TableCell>
              <TableCell className="text-right tabular-nums">{count(r.backlinks)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  );
}

function Gap({ domain }: { domain: string }) {
  const [rivals, setRivals] = useState(["", "", "", ""]);
  const [data, setData] = useState<{ competitors: string[]; rows: Awaited<ReturnType<typeof getBacklinkGap>> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function compare() {
    const competitors = rivals.map((r) => r.trim()).filter(Boolean);
    setLoading(true);
    setError(null);
    try {
      setData({ competitors, rows: await getBacklinkGap({ data: { domain, competitors } }) });
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void compare();
        }}
      >
        <CompetitorFields values={rivals} onChange={setRivals} />
        <Button type="submit" disabled={!rivals.some((r) => r.trim())} pending={loading}>
          Compare
        </Button>
      </form>
      {error ? <EmptyState kind="error" title={error} /> : null}
      {data ? (
        data.rows.length === 0 ? (
          <EmptyState title={`Every domain linking to these competitors also links to ${domain}`} variant="plain" />
        ) : (
          <TableCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referring domain</TableHead>
                  <TableHead className="text-right">Rank</TableHead>
                  {data.competitors.map((c) => (
                    <TableHead key={c} className="text-right">
                      {c}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.domain} data-testid="backlink-gap-row">
                    <TableCell className="font-medium">{r.domain}</TableCell>
                    <TableCell className="text-right tabular-nums">{count(r.rank)}</TableCell>
                    {r.links.map((n, i) => (
                      <TableCell key={i} className="text-right tabular-nums">
                        {n ? count(n) : "–"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )
      ) : null}
    </>
  );
}
