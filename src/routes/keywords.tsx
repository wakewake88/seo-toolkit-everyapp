import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Choice } from "@/client/components/Choice";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { SaveToListDialog } from "@/client/components/SaveToList";
import { SearchDataOff } from "@/client/components/SearchDataOff";
import { Shell } from "@/client/components/Shell";
import { Sparkline } from "@/client/components/Sparkline";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
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
import { capitalize, count, messageOf, money } from "@/client/lib/format";
import { DEFAULT_LOCATION, LANGUAGES, LOCATIONS, defaultLanguage } from "@/shared/locations";
import { getProjects } from "@/serverFunctions/projects";
import { findKeywordIdeas, getSearchDataStatus, getTopResults } from "@/serverFunctions/research";

export const Route = createFileRoute("/keywords")({
  loader: async () => {
    const [status, { projects }] = await Promise.all([getSearchDataStatus(), getProjects()]);
    return { ready: status.ready, projects: projects.map((p) => ({ id: p.id, name: p.name })) };
  },
  head: () => ({ meta: [{ title: "Keyword research · SEO Toolkit" }] }),
  component: Keywords,
});

type Idea = Awaited<ReturnType<typeof findKeywordIdeas>>[number];
type SortKey = "keyword" | "volume" | "difficulty" | "cpc";

const LOCATION_ITEMS = LOCATIONS.map((l) => ({ value: l.code, label: l.name }));
const LANGUAGE_ITEMS = LANGUAGES.map((l) => ({ value: l.code, label: l.name }));
const INTENT_ITEMS = [
  { value: "all", label: "Any intent" },
  { value: "informational", label: "Informational" },
  { value: "navigational", label: "Navigational" },
  { value: "commercial", label: "Commercial" },
  { value: "transactional", label: "Transactional" },
];

function Keywords() {
  const { ready, projects } = Route.useLoaderData();
  const [seed, setSeed] = useState("");
  const [location, setLocation] = useState<number>(DEFAULT_LOCATION);
  const [language, setLanguage] = useState(defaultLanguage(DEFAULT_LOCATION));
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ minVolume: "", maxVolume: "", minKd: "", maxKd: "", include: "", exclude: "", intent: "all" });
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [serpFor, setSerpFor] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    setError(null);
    try {
      setIdeas(await findKeywordIdeas({ data: { seed, location, language } }));
      setSelected(new Set());
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    if (!ideas) return [];
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    const minV = num(filters.minVolume), maxV = num(filters.maxVolume), minK = num(filters.minKd), maxK = num(filters.maxKd);
    const include = filters.include.trim().toLowerCase(), exclude = filters.exclude.trim().toLowerCase();
    const out = ideas.filter(
      (i) =>
        (minV === null || (i.volume ?? 0) >= minV) &&
        (maxV === null || (i.volume ?? 0) <= maxV) &&
        (minK === null || (i.difficulty ?? 0) >= minK) &&
        (maxK === null || (i.difficulty ?? 0) <= maxK) &&
        (!include || i.keyword.includes(include)) &&
        (!exclude || !i.keyword.includes(exclude)) &&
        (filters.intent === "all" || i.intent === filters.intent),
    );
    if (sort) {
      out.sort((a, b) => {
        const d =
          sort.key === "keyword"
            ? a.keyword.localeCompare(b.keyword)
            : ((a[sort.key] ?? -1) as number) - ((b[sort.key] ?? -1) as number);
        return sort.desc ? -d : d;
      });
    }
    return out;
  }, [ideas, filters, sort]);

  const setFilter = (key: keyof typeof filters) => (value: string) => setFilters((f) => ({ ...f, [key]: value }));
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s?.key === key ? { key, desc: !s.desc } : { key, desc: key !== "keyword" }));
  const picked = (ideas ?? [])
    .filter((i) => selected.has(i.keyword))
    .map(({ keyword, volume, difficulty, cpc, intent }) => ({
      keyword,
      volume: volume === null ? null : Math.round(volume),
      difficulty: difficulty === null ? null : Math.round(difficulty),
      cpc,
      intent,
    }));

  return (
    <Shell>
      <PageHeader title="Keyword research" />
      {!ready ? <SearchDataOff /> : null}
      <Card>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_12rem_10rem_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (seed.trim()) void search();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="seed">Seed keyword</Label>
              <Input id="seed" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="running shoes" />
            </div>
            <Choice
              id="kw-location"
              label="Location"
              value={location}
              onChange={(v) => {
                setLocation(v);
                setLanguage(defaultLanguage(v));
              }}
              items={LOCATION_ITEMS}
            />
            <Choice id="kw-language" label="Language" value={language} onChange={setLanguage} items={LANGUAGE_ITEMS} />
            <Button type="submit" disabled={!ready} pending={loading}>
              Find keywords
            </Button>
          </form>
        </CardContent>
      </Card>

      {error ? <EmptyState kind="error" title={error} /> : null}

      {ideas ? (
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <FilterField id="min-volume" label="Minimum volume" value={filters.minVolume} onChange={setFilter("minVolume")} numeric />
            <FilterField id="max-volume" label="Maximum volume" value={filters.maxVolume} onChange={setFilter("maxVolume")} numeric />
            <FilterField id="min-kd" label="Minimum difficulty" value={filters.minKd} onChange={setFilter("minKd")} numeric />
            <FilterField id="max-kd" label="Maximum difficulty" value={filters.maxKd} onChange={setFilter("maxKd")} numeric />
            <FilterField id="include" label="Include word" value={filters.include} onChange={setFilter("include")} />
            <FilterField id="exclude" label="Exclude word" value={filters.exclude} onChange={setFilter("exclude")} />
            <Choice id="intent" label="Intent" value={filters.intent} onChange={setFilter("intent")} items={INTENT_ITEMS} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {rows.length} of {ideas.length} keywords
            </p>
            <Button variant="outline" disabled={picked.length === 0} onClick={() => setSaving(true)}>
              Save to list{picked.length ? ` (${picked.length})` : ""}
            </Button>
          </div>
          {rows.length === 0 ? (
            <EmptyState kind="filtered" title={ideas.length ? "No keywords match these filters" : "No ideas for this keyword"} />
          ) : (
            <TableCard>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <SortHead label="Keyword" sortKey="keyword" sort={sort} onSort={toggleSort} />
                    <SortHead label="Volume" sortKey="volume" sort={sort} onSort={toggleSort} right />
                    <SortHead label="Difficulty" sortKey="difficulty" sort={sort} onSort={toggleSort} right />
                    <SortHead label="CPC" sortKey="cpc" sort={sort} onSort={toggleSort} right />
                    <TableHead>Intent</TableHead>
                    <TableHead>Trend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((idea) => (
                    <TableRow key={idea.keyword} data-testid="idea-row">
                      <TableCell>
                        <Checkbox
                          aria-label={`Select ${idea.keyword}`}
                          checked={selected.has(idea.keyword)}
                          onCheckedChange={(on) =>
                            setSelected((s) => {
                              const next = new Set(s);
                              if (on) next.add(idea.keyword);
                              else next.delete(idea.keyword);
                              return next;
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <button type="button" className="cursor-pointer text-left font-medium hover:underline" onClick={() => setSerpFor(idea.keyword)}>
                          {idea.keyword}
                        </button>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{count(idea.volume)}</TableCell>
                      <TableCell className="text-right tabular-nums">{idea.difficulty ?? "–"}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(idea.cpc)}</TableCell>
                      <TableCell>{idea.intent ? <Badge variant="secondary">{capitalize(idea.intent)}</Badge> : "–"}</TableCell>
                      <TableCell>
                        <Sparkline values={idea.trend} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableCard>
          )}
        </section>
      ) : null}

      {serpFor ? <SerpDialog keyword={serpFor} location={location} language={language} onClose={() => setSerpFor(null)} /> : null}
      {saving ? <SaveToListDialog projects={projects} keywords={picked} onClose={() => setSaving(false)} /> : null}
    </Shell>
  );
}

function FilterField({ id, label, value, onChange, numeric }: { id: string; label: string; value: string; onChange: (v: string) => void; numeric?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input id={id} value={value} inputMode={numeric ? "numeric" : undefined} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SortHead({
  label,
  sortKey,
  sort,
  onSort,
  right,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; desc: boolean } | null;
  onSort: (key: SortKey) => void;
  right?: boolean;
}) {
  const Icon = sort?.key !== sortKey ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp;
  return (
    <TableHead className={right ? "text-right" : undefined}>
      <button
        type="button"
        aria-label={`Sort by ${label.toLowerCase()}`}
        onClick={() => onSort(sortKey)}
        className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
      >
        {label}
        <Icon className="size-3.5" aria-hidden />
      </button>
    </TableHead>
  );
}

function SerpDialog({ keyword, location, language, onClose }: { keyword: string; location: number; language: string; onClose: () => void }) {
  const [state, setState] = useState<{ data?: Awaited<ReturnType<typeof getTopResults>>; error?: string } | null>(null);
  if (state === null) {
    setState({});
    getTopResults({ data: { keyword, location, language } }).then(
      (data) => setState({ data }),
      (error) => setState({ error: messageOf(error) }),
    );
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{keyword}</DialogTitle>
        </DialogHeader>
        {state?.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : !state?.data ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1" data-testid="serp-features">
              {state.data.features.map((f) => (
                <Badge key={f} variant="secondary">
                  {f}
                </Badge>
              ))}
            </div>
            <ol className="max-h-96 divide-y divide-border overflow-y-auto text-sm">
              {state.data.results.map((r) => (
                <li key={r.position + r.url} data-testid="serp-row" className="flex gap-3 py-2">
                  <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">{r.position}</span>
                  <div className="min-w-0">
                    <div className="font-medium">{r.domain}</div>
                    <a href={r.url} target="_blank" rel="noreferrer noopener" className="block truncate text-primary hover:underline">
                      {r.url}
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
