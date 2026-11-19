import { z } from "zod";
import { normalizeDomain, DOMAIN_ERROR } from "@/shared/domain";
import { LANGUAGES, LOCATIONS, featureName } from "@/shared/locations";
import { searchData } from "@/server/searchData";

const location = z
  .number()
  .int()
  .refine((code) => LOCATIONS.some((l) => l.code === code), "Pick a location");
const language = z
  .string()
  .refine((code) => LANGUAGES.some((l) => l.code === code), "Pick a language");
const domain = z.string().transform((value, ctx) => {
  const host = normalizeDomain(value);
  if (!host) {
    ctx.addIssue({ code: "custom", message: DOMAIN_ERROR });
    return z.NEVER;
  }
  return host;
});

export const ideasInput = z
  .object({
    seed: z.string().trim().min(1, "Enter a keyword").max(80),
    location,
    language,
  })
  .strict();
export const serpInput = z
  .object({ keyword: z.string().trim().min(1).max(200), location, language })
  .strict();
export const domainInput = z.object({ domain, location }).strict();
export const gapInput = z
  .object({
    projectId: z.string().min(1),
    competitors: z.array(domain).min(1, "Add a competitor").max(4),
    location,
  })
  .strict();
export const backlinksInput = z
  .object({
    domain,
    follow: z.enum(["all", "follow", "nofollow"]),
    page: z.number().int().min(1).max(200),
  })
  .strict();
export const backlinkGapInput = z
  .object({
    domain,
    competitors: z.array(domain).min(1, "Add a competitor").max(4),
  })
  .strict();

export interface KeywordIdea {
  keyword: string;
  volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  intent: string | null;
  /** Monthly volumes, oldest first. */
  trend: number[];
}

interface IdeaItem {
  keyword: string;
  keyword_info?: {
    search_volume?: number | null;
    cpc?: number | null;
    monthly_searches?: { year: number; month: number; search_volume: number | null }[] | null;
  };
  keyword_properties?: { keyword_difficulty?: number | null };
  search_intent_info?: { main_intent?: string | null } | null;
}

export async function keywordIdeas(
  input: z.infer<typeof ideasInput>,
): Promise<KeywordIdea[]> {
  const result = await searchData<{ items?: IdeaItem[] | null }>(
    "/dataforseo_labs/google/keyword_ideas/live",
    {
      keywords: [input.seed],
      location_code: input.location,
      language_code: input.language,
      limit: 300,
      include_serp_info: false,
    },
  );
  return (result?.items ?? []).map((item) => ({
    keyword: item.keyword,
    volume: item.keyword_info?.search_volume ?? null,
    difficulty: item.keyword_properties?.keyword_difficulty ?? null,
    cpc: item.keyword_info?.cpc ?? null,
    intent: item.search_intent_info?.main_intent ?? null,
    trend: [...(item.keyword_info?.monthly_searches ?? [])]
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .map((m) => m.search_volume ?? 0),
  }));
}

interface SerpItem {
  type: string;
  rank_group?: number;
  rank_absolute?: number;
  domain?: string;
  url?: string;
  title?: string;
}
export interface SerpPage {
  items: SerpItem[];
  item_types?: string[];
}

export async function liveSerp(task: {
  keyword: string;
  location: number;
  language: string;
  device?: "desktop" | "mobile";
  depth?: number;
  background?: boolean;
}): Promise<SerpPage> {
  const result = await searchData<SerpPage>(
    "/serp/google/organic/live/advanced",
    {
      keyword: task.keyword,
      location_code: task.location,
      language_code: task.language,
      device: task.device ?? "desktop",
      depth: task.depth ?? 10,
    },
    task.background,
  );
  return { items: result?.items ?? [], item_types: result?.item_types ?? [] };
}

export interface SerpTop {
  results: { position: number; url: string; domain: string; title: string }[];
  features: string[];
}

export async function topResults(
  input: z.infer<typeof serpInput>,
): Promise<SerpTop> {
  const page = await liveSerp({ ...input, depth: 10 });
  const results = page.items
    .filter((i) => i.type === "organic" && i.url)
    .slice(0, 10)
    .map((i) => ({
      position: i.rank_group ?? 0,
      url: i.url!,
      domain: i.domain ?? new URL(i.url!).hostname,
      title: i.title ?? "",
    }));
  const features = (page.item_types ?? [])
    .filter((t) => t !== "organic")
    .map(featureName);
  return { results, features };
}

interface RankedItem {
  keyword_data?: { keyword?: string; keyword_info?: { search_volume?: number | null } };
  ranked_serp_element?: { serp_item?: { rank_group?: number; url?: string } };
}
export interface RankedKeyword {
  keyword: string;
  position: number;
  volume: number | null;
  url: string;
}

async function rankedKeywords(
  target: string,
  location: number,
  limit: number,
): Promise<RankedKeyword[]> {
  const result = await searchData<{ items?: RankedItem[] | null }>(
    "/dataforseo_labs/google/ranked_keywords/live",
    {
      target,
      location_code: location,
      limit,
      order_by: ["keyword_data.keyword_info.search_volume,desc"],
    },
  );
  return (result?.items ?? []).flatMap((item) => {
    const keyword = item.keyword_data?.keyword;
    const position = item.ranked_serp_element?.serp_item?.rank_group;
    if (!keyword || !position) return [];
    return [
      {
        keyword,
        position,
        volume: item.keyword_data?.keyword_info?.search_volume ?? null,
        url: item.ranked_serp_element?.serp_item?.url ?? "",
      },
    ];
  });
}

export interface DomainOverview {
  domain: string;
  rankingKeywords: number;
  traffic: number;
  topKeywords: RankedKeyword[];
  competitors: { domain: string; overlap: number; keywords: number | null; traffic: number | null }[];
}

export async function domainOverview(
  input: z.infer<typeof domainInput>,
): Promise<DomainOverview> {
  const [overview, top, rivals] = await Promise.all([
    searchData<{ items?: { metrics?: { organic?: { count?: number; etv?: number } } }[] }>(
      "/dataforseo_labs/google/domain_rank_overview/live",
      { target: input.domain, location_code: input.location },
    ),
    rankedKeywords(input.domain, input.location, 50),
    searchData<{
      items?: {
        domain: string;
        intersections?: number;
        full_domain_metrics?: { organic?: { count?: number; etv?: number } };
      }[];
    }>("/dataforseo_labs/google/competitors_domain/live", {
      target: input.domain,
      location_code: input.location,
      limit: 20,
    }),
  ]);
  const organic = overview?.items?.[0]?.metrics?.organic;
  return {
    domain: input.domain,
    rankingKeywords: organic?.count ?? 0,
    traffic: Math.round(organic?.etv ?? 0),
    topKeywords: top,
    competitors: (rivals?.items ?? [])
      .filter((c) => normalizeDomain(c.domain) !== input.domain)
      .map((c) => ({
        domain: c.domain,
        overlap: c.intersections ?? 0,
        keywords: c.full_domain_metrics?.organic?.count ?? null,
        traffic:
          c.full_domain_metrics?.organic?.etv == null
            ? null
            : Math.round(c.full_domain_metrics.organic.etv),
      }))
      .sort((a, b) => b.overlap - a.overlap),
  };
}

export interface GapRow {
  keyword: string;
  volume: number | null;
  /** The project's position, or null when it doesn't rank. */
  own: number | null;
  /** Each competitor's position, in the order given. */
  rivals: (number | null)[];
  kind: "missing" | "weaker" | "shared";
}

/**
 * Keywords the competitors rank for: missing (the project doesn't rank),
 * weaker (it ranks below the best competitor) and shared (both rank).
 * Weaker rows are also shared.
 */
export function keywordGap(
  own: RankedKeyword[],
  rivals: RankedKeyword[][],
): GapRow[] {
  const mine = new Map(own.map((k) => [k.keyword, k]));
  const keywords = new Map<string, number | null>();
  for (const list of rivals)
    for (const k of list) if (!keywords.has(k.keyword)) keywords.set(k.keyword, k.volume);
  const rows: GapRow[] = [];
  for (const [keyword, volume] of keywords) {
    const ownPos = mine.get(keyword)?.position ?? null;
    const positions = rivals.map(
      (list) => list.find((k) => k.keyword === keyword)?.position ?? null,
    );
    const best = Math.min(...positions.filter((p): p is number => p !== null));
    rows.push({
      keyword,
      volume: volume ?? mine.get(keyword)?.volume ?? null,
      own: ownPos,
      rivals: positions,
      kind: ownPos === null ? "missing" : ownPos > best ? "weaker" : "shared",
    });
  }
  return rows.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
}

export async function compareKeywords(
  projectDomain: string,
  competitors: string[],
  location: number,
): Promise<GapRow[]> {
  const [own, ...rivals] = await Promise.all(
    [projectDomain, ...competitors].map((d) => rankedKeywords(d, location, 1000)),
  );
  return keywordGap(own!, rivals);
}

export interface BacklinkSummary {
  backlinks: number;
  referringDomains: number;
  rank: number;
}

export async function backlinkSummary(target: string): Promise<BacklinkSummary> {
  const result = await searchData<{
    backlinks?: number;
    referring_domains?: number;
    rank?: number;
  }>("/backlinks/summary/live", { target, include_subdomains: true });
  return {
    backlinks: result?.backlinks ?? 0,
    referringDomains: result?.referring_domains ?? 0,
    rank: result?.rank ?? 0,
  };
}

export const BACKLINK_PAGE = 50;

export interface Backlink {
  source: string;
  target: string;
  anchor: string;
  follow: boolean;
  firstSeen: string | null;
}

export async function backlinks(
  input: z.infer<typeof backlinksInput>,
): Promise<{ total: number; rows: Backlink[] }> {
  const result = await searchData<{
    total_count?: number;
    items?: {
      url_from: string;
      url_to: string;
      anchor?: string | null;
      dofollow?: boolean;
      first_seen?: string | null;
    }[];
  }>("/backlinks/backlinks/live", {
    target: input.domain,
    mode: "as_is",
    limit: BACKLINK_PAGE,
    offset: (input.page - 1) * BACKLINK_PAGE,
    order_by: ["rank,desc"],
    ...(input.follow === "all"
      ? {}
      : { filters: ["dofollow", "=", input.follow === "follow"] }),
  });
  return {
    total: result?.total_count ?? 0,
    rows: (result?.items ?? []).map((i) => ({
      source: i.url_from,
      target: i.url_to,
      anchor: i.anchor ?? "",
      follow: i.dofollow ?? false,
      firstSeen: i.first_seen ? i.first_seen.slice(0, 10) : null,
    })),
  };
}

export interface ReferringDomain {
  domain: string;
  rank: number;
  backlinks: number;
}

export async function referringDomains(
  target: string,
  limit = 100,
): Promise<ReferringDomain[]> {
  const result = await searchData<{
    items?: { domain: string; rank?: number; backlinks?: number }[];
  }>("/backlinks/referring_domains/live", {
    target,
    limit,
    order_by: ["rank,desc"],
  });
  return (result?.items ?? []).map((i) => ({
    domain: i.domain,
    rank: i.rank ?? 0,
    backlinks: i.backlinks ?? 0,
  }));
}

export interface BacklinkGapRow {
  domain: string;
  rank: number;
  /** Links from this domain to each competitor, in the order given. */
  links: number[];
}

/** Domains linking to any competitor but not to the target. */
export async function backlinkGap(
  input: z.infer<typeof backlinkGapInput>,
): Promise<BacklinkGapRow[]> {
  const [own, ...rivals] = await Promise.all(
    [input.domain, ...input.competitors].map((d) => referringDomains(d, 1000)),
  );
  const have = new Set(own!.map((r) => r.domain));
  const rows = new Map<string, BacklinkGapRow>();
  rivals.forEach((list, index) => {
    for (const r of list) {
      if (have.has(r.domain)) continue;
      const row = rows.get(r.domain) ?? {
        domain: r.domain,
        rank: r.rank,
        links: input.competitors.map(() => 0),
      };
      row.links[index] = r.backlinks;
      rows.set(r.domain, row);
    }
  });
  return [...rows.values()].sort((a, b) => b.rank - a.rank);
}
