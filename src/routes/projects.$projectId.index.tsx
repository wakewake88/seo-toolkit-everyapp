import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Choice } from "@/client/components/Choice";
import { EmptyState } from "@/client/components/EmptyState";
import { SearchDataOff } from "@/client/components/SearchDataOff";
import { Stat } from "@/client/components/Stat";
import { TrendChart } from "@/client/components/TrendChart";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
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
import { Textarea } from "@/client/components/ui/textarea";
import { day, messageOf, when } from "@/client/lib/format";
import { DEFAULT_LOCATION, LOCATIONS, locationName } from "@/shared/locations";
import {
  addCompetitor,
  checkRankingsNow,
  getTracking,
  removeCompetitor,
  stopTracking,
  trackKeywords,
} from "@/serverFunctions/tracking";

export const Route = createFileRoute("/projects/$projectId/")({
  loader: ({ params }) => getTracking({ data: { projectId: params.projectId } }),
  component: Rankings,
});

const LOCATION_ITEMS = LOCATIONS.map((l) => ({ value: l.code, label: l.name }));
const DEVICE_ITEMS = [
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
] as const;

function Rankings() {
  const view = Route.useLoaderData();
  const { projectId } = Route.useParams();
  const router = useRouter();
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState<number>(DEFAULT_LOCATION);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [competitor, setCompetitor] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const running = view.status.state === "running";

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => void router.invalidate(), 3000);
    return () => clearInterval(timer);
  }, [running, router]);

  async function act(name: string, work: () => Promise<unknown>, done?: () => void) {
    setBusy(name);
    try {
      await work();
      done?.();
      await router.invalidate();
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setBusy(null);
    }
  }

  const domains = [view.domain, ...view.competitors.map((c) => c.domain)];
  const points = view.history.map((h) => ({
    label: day(h.at),
    ...Object.fromEntries(h.values.map((v, i) => [`d${i}`, v])),
  }));
  const inTop10 = view.keywords.filter((k) => k.position !== null && k.position <= 10).length;

  return (
    <div className="space-y-8">
      {view.ready ? null : <SearchDataOff />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" data-testid="check-status">
          {view.status.state === "running"
            ? "Checking positions…"
            : view.status.state === "done"
              ? `Last checked ${when(view.status.at)}`
              : view.status.state === "failed"
                ? `Last check failed: ${view.status.error ?? "no answer"}`
                : "Not checked yet"}
        </p>
        <Button
          variant="outline"
          disabled={!view.ready || running || view.keywords.length === 0}
          pending={busy === "check"}
          onClick={() => act("check", () => checkRankingsNow({ data: { projectId } }))}
        >
          Check now
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Visibility"
          testId="visibility"
          value={view.visibility === null ? "–" : `${view.visibility}%`}
        />
        <Stat label="Tracked keywords" value={view.keywords.length} />
        <Stat label="In the top 10" value={inTop10} />
      </div>

      {points.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Visibility over time</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart
              testId="history-chart"
              points={points}
              unit="%"
              series={domains.map((d, i) => ({ key: `d${i}`, label: d }))}
            />
          </CardContent>
        </Card>
      ) : null}

      {view.keywords.length === 0 ? (
        <EmptyState
          title="No keywords tracked"
          description="Add the searches you want this site to rank for."
        />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead className="text-right">Position</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead>Ranking URL</TableHead>
                <TableHead>Features owned</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.keywords.map((k) => (
                <TableRow key={k.id} data-testid="tracked-row">
                  <TableCell>
                    <div className="font-medium">{k.keyword}</div>
                    <div className="text-xs text-muted-foreground">
                      {locationName(k.location)} · {k.device === "mobile" ? "Mobile" : "Desktop"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span data-testid="position">
                      {!k.checked ? "–" : k.position === null ? "Not in top 100" : k.position}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Change value={k.change} />
                  </TableCell>
                  <TableCell className="max-w-64 truncate">
                    {k.url ? (
                      <a
                        href={k.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-primary hover:underline"
                      >
                        {k.url.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1" data-testid="owned-features">
                      {k.owned.map((f) => (
                        <Badge key={f} variant="secondary">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Stop tracking ${k.keyword}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => act(`stop-${k.id}`, () => stopTracking({ data: { projectId, id: k.id } }))}
                    >
                      <X />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}

      {view.competitors.length > 0 && view.keywords.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">Against competitors</h2>
          <TableCard data-testid="competitor-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  {domains.map((d) => (
                    <TableHead key={d} className="text-right">
                      {d}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.comparison.map((row) => (
                  <TableRow key={row.keyword}>
                    <TableCell className="font-medium">{row.keyword}</TableCell>
                    {row.positions.map((p, i) => (
                      <TableCell key={domains[i]} className="text-right tabular-nums">
                        {p ?? "–"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Track keywords</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                const list = keywords.split("\n").map((k) => k.trim()).filter(Boolean);
                if (list.length === 0) return;
                void act(
                  "track",
                  () => trackKeywords({ data: { projectId, keywords: list, location, device } }),
                  () => setKeywords(""),
                );
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="track-keywords">Keywords to track</Label>
                <Textarea
                  id="track-keywords"
                  rows={4}
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="One per line"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Choice id="track-location" label="Location" value={location} onChange={setLocation} items={LOCATION_ITEMS} />
                <Choice id="track-device" label="Device" value={device} onChange={setDevice} items={DEVICE_ITEMS} />
              </div>
              <Button type="submit" pending={busy === "track"}>
                Track keywords
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Competitors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!competitor.trim()) return;
                void act(
                  "competitor",
                  () => addCompetitor({ data: { projectId, domain: competitor } }),
                  () => setCompetitor(""),
                );
              }}
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="competitor-domain">Competitor domain</Label>
                <Input
                  id="competitor-domain"
                  value={competitor}
                  onChange={(e) => setCompetitor(e.target.value)}
                  placeholder="competitor.com"
                />
              </div>
              <Button type="submit" variant="outline" pending={busy === "competitor"}>
                Add competitor
              </Button>
            </form>
            <div className="flex flex-wrap gap-2">
              {view.competitors.map((c) => (
                <Badge key={c.id} variant="outline" data-testid="competitor-chip" className="gap-1 pr-0.5">
                  {c.domain}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${c.domain}`}
                    onClick={() => act(`rc-${c.id}`, () => removeCompetitor({ data: { projectId, id: c.id } }))}
                  >
                    <X />
                  </Button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <span data-testid="change" className="text-muted-foreground" />;
  const text = value > 0 ? `+${value}` : String(value);
  const tone = value > 0 ? "text-success" : value < 0 ? "text-destructive" : "text-muted-foreground";
  return (
    <span data-testid="change" className={tone}>
      {text}
    </span>
  );
}
