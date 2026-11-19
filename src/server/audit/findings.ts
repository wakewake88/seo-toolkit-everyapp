import { MAX_HTML_BYTES, RULES, type RuleId } from "@/shared/auditRules";
import type { CrawledPage } from "@/server/audit/crawl";

export interface Finding {
  rule: RuleId;
  url: string;
  detail: string | null;
}

/** Every rule a crawl breaks, page by page and across the site. */
export function findings(pages: CrawledPage[], robotsUrl: string, aiBlocked: string[]): Finding[] {
  const out: Finding[] = [];
  const add = (rule: RuleId, url: string, detail: string | null = null) =>
    out.push({ rule, url, detail });
  const status = new Map(pages.map((p) => [p.url, p.status]));
  const titles = new Map<string, string[]>();
  const descriptions = new Map<string, string[]>();

  for (const page of pages) {
    if (page.status >= 400) add("http_error", page.url, `Status ${page.status}`);
    if (page.redirects.length >= 2) {
      add("redirect_chain", page.url, `${page.redirects.length} hops to ${page.finalUrl}`);
    }
    for (const link of page.links) {
      const code = status.get(link);
      if (code !== undefined && code >= 400) add("broken_link", page.url, `${link} (${code})`);
    }
    for (const link of page.httpLinks) add("http_link", page.url, link);
    if (!page.html || page.status !== 200) continue;
    if (!page.title) add("title_missing", page.url);
    else titles.set(page.title, [...(titles.get(page.title) ?? []), page.url]);
    if (!page.description) add("description_missing", page.url);
    else descriptions.set(page.description, [...(descriptions.get(page.description) ?? []), page.url]);
    if (page.h1 === 0) add("h1_missing", page.url);
    if (page.h1 > 1) add("h1_multiple", page.url, `${page.h1} H1 headings`);
    if (page.imagesWithoutAlt > 0) {
      add("image_alt", page.url, `${page.imagesWithoutAlt} image${page.imagesWithoutAlt === 1 ? "" : "s"}`);
    }
    if (page.noindex) add("noindex", page.url);
    if (!page.canonical) add("canonical_missing", page.url);
    if (page.bytes > MAX_HTML_BYTES) add("html_size", page.url, `${Math.round(page.bytes / 1024)} KB`);
  }
  for (const urls of titles.values()) {
    if (urls.length > 1) for (const url of urls) add("title_duplicate", url, `Shared by ${urls.length} pages`);
  }
  for (const urls of descriptions.values()) {
    if (urls.length > 1) for (const url of urls) add("description_duplicate", url, `Shared by ${urls.length} pages`);
  }
  if (aiBlocked.length) add("ai_blocked", robotsUrl, aiBlocked.join(", "));
  return out;
}

export const severityOf = (rule: RuleId) => RULES[rule].severity;
