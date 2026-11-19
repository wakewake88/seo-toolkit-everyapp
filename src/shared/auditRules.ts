export type Severity = "error" | "warning" | "notice";

export interface Rule {
  title: string;
  severity: Severity;
  category: string;
  tip: string;
}

/** The fixed checks every page goes through, by id. */
export const RULES = {
  http_error: {
    title: "4xx or 5xx status",
    severity: "error",
    category: "Crawlability",
    tip: "Restore the page, redirect it to its replacement, or remove links to it.",
  },
  broken_link: {
    title: "Broken internal link",
    severity: "error",
    category: "Links",
    tip: "Point the link at a page that loads, or remove it.",
  },
  title_missing: {
    title: "Missing title",
    severity: "error",
    category: "Content",
    tip: "Give the page a unique <title> of about 50–60 characters.",
  },
  redirect_chain: {
    title: "Redirect chain",
    severity: "warning",
    category: "Crawlability",
    tip: "Redirect straight to the final address and update links to it.",
  },
  title_duplicate: {
    title: "Duplicate title",
    severity: "warning",
    category: "Content",
    tip: "Write a title that says what sets this page apart.",
  },
  description_missing: {
    title: "Missing meta description",
    severity: "warning",
    category: "Content",
    tip: "Add a meta description that sums up the page in one or two sentences.",
  },
  description_duplicate: {
    title: "Duplicate meta description",
    severity: "warning",
    category: "Content",
    tip: "Describe each page in its own words.",
  },
  h1_missing: {
    title: "Missing H1",
    severity: "warning",
    category: "Content",
    tip: "Add one H1 heading that names the page's topic.",
  },
  image_alt: {
    title: "Image without alt text",
    severity: "warning",
    category: "Accessibility",
    tip: "Describe each meaningful image in its alt attribute; use alt=\"\" for decoration.",
  },
  http_link: {
    title: "Link to HTTP page",
    severity: "warning",
    category: "Security",
    tip: "Link to the https:// address instead.",
  },
  html_size: {
    title: "Oversized HTML",
    severity: "warning",
    category: "Performance",
    tip: "Keep the HTML under 2 MB: move inline scripts, styles and data out of the page.",
  },
  h1_multiple: {
    title: "Multiple H1",
    severity: "notice",
    category: "Content",
    tip: "Keep one H1 and turn the others into H2s.",
  },
  noindex: {
    title: "Noindex page",
    severity: "notice",
    category: "Indexability",
    tip: "Remove the noindex directive if the page should appear in search.",
  },
  canonical_missing: {
    title: "Missing canonical",
    severity: "notice",
    category: "Indexability",
    tip: "Add <link rel=\"canonical\"> pointing at the page's preferred address.",
  },
  ai_blocked: {
    title: "AI crawlers blocked",
    severity: "notice",
    category: "Crawlability",
    tip: "Allow AI crawlers in robots.txt if the site should be cited by AI assistants.",
  },
} as const satisfies Record<string, Rule>;

export type RuleId = keyof typeof RULES;

export const SEVERITY_ORDER: Severity[] = ["error", "warning", "notice"];

export const PAGE_LIMITS = [10, 50, 100, 250, 500] as const;
export const MAX_HTML_BYTES = 2 * 1024 * 1024;

/** Crawlers of AI assistants and model makers that robots.txt can shut out. */
export const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "PerplexityBot",
  "CCBot",
  "Applebot-Extended",
];

export const CRAWLER_NAME = "SiteHealthCheck";

interface Group {
  agents: string[];
  rules: { allow: boolean; path: string }[];
}

export function parseRobots(text: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      if (value) current.rules.push({ allow: key === "allow", path: value });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

function groupFor(groups: Group[], agent: string): Group | null {
  const name = agent.toLowerCase();
  return (
    groups.find((g) => g.agents.some((a) => a !== "*" && name.includes(a))) ??
    groups.find((g) => g.agents.includes("*")) ??
    null
  );
}

function matchesPath(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

/** Whether robots.txt lets `agent` fetch `path` (path plus query). */
export function robotsAllows(groups: Group[], agent: string, path: string): boolean {
  const group = groupFor(groups, agent);
  if (!group) return true;
  let best: { allow: boolean; length: number } | null = null;
  for (const rule of group.rules) {
    if (!matchesPath(rule.path, path)) continue;
    const length = rule.path.length;
    if (!best || length > best.length || (length === best.length && rule.allow)) {
      best = { allow: rule.allow, length };
    }
  }
  return best?.allow ?? true;
}

/** The AI crawlers robots.txt keeps off the whole site. */
export function blockedAiCrawlers(groups: Group[]): string[] {
  return AI_CRAWLERS.filter((bot) => {
    const group = groups.find((g) => g.agents.includes(bot.toLowerCase()));
    return group ? !robotsAllows([group], bot, "/") : false;
  });
}

/** Health 0-100: the share of pages free of problems, errors weighing most. */
export function healthScore(
  pages: number,
  issues: { url: string; severity: Severity }[],
): number {
  if (pages === 0) return 0;
  const penalty = new Map<string, number>();
  const weight = { error: 0.5, warning: 0.1, notice: 0.02 };
  for (const issue of issues) {
    penalty.set(issue.url, (penalty.get(issue.url) ?? 0) + weight[issue.severity]);
  }
  let lost = 0;
  for (const value of penalty.values()) lost += Math.min(1, value);
  return Math.max(0, Math.min(100, Math.round(100 * (1 - lost / Math.max(pages, penalty.size)))));
}
