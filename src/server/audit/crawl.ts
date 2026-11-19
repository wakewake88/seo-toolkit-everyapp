import { env } from "cloudflare:workers";
import { CRAWLER_NAME, MAX_HTML_BYTES } from "@/shared/auditRules";

export interface CrawledPage {
  url: string;
  status: number;
  /** Redirect hops before the final address, when the page redirects. */
  redirects: string[];
  finalUrl: string | null;
  html: boolean;
  bytes: number;
  title: string | null;
  description: string | null;
  h1: number;
  imagesWithoutAlt: number;
  noindex: boolean;
  canonical: string | null;
  /** Same-site links, absolute and without fragments. */
  links: string[];
  /** Same-site links written with http://. */
  httpLinks: string[];
}

const USER_AGENT = `Mozilla/5.0 (compatible; ${CRAWLER_NAME}/1.0)`;
const MAX_LINKS = 400;

/**
 * Fetches for the crawler. The site is on the public internet; the checks
 * give the Worker a CRAWLER binding that serves a fixed test site instead.
 */
export function crawlerFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = { "user-agent": USER_AGENT, accept: "text/html,*/*;q=0.5" };
  const request = { ...init, headers, redirect: "manual" as const, signal: AbortSignal.timeout(15_000) };
  return env.CRAWLER ? env.CRAWLER.fetch(url, request) : fetch(url, request);
}

export function sameSite(host: string, domain: string): boolean {
  const bare = host.replace(/^www\./, "");
  return bare === domain;
}

/** The address to crawl for a link on `base`, or null when it leaves the site. */
export function internalUrl(href: string, base: string, domain: string): URL | null {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!sameSite(url.hostname, domain)) return null;
  url.hash = "";
  return url;
}

/** Fetches a page, following up to ten same-site redirects. */
export async function crawlPage(url: string, domain: string): Promise<CrawledPage> {
  const redirects: string[] = [];
  let current = url;
  let response = await crawlerFetch(current);
  while (response.status >= 300 && response.status < 400 && redirects.length < 10) {
    const location = response.headers.get("location");
    const next = location ? internalUrl(location, current, domain) : null;
    if (!next) break;
    redirects.push(current);
    current = next.toString();
    response = await crawlerFetch(current);
  }
  const page: CrawledPage = {
    url,
    status: redirects.length ? 301 : response.status,
    redirects,
    finalUrl: redirects.length ? current : null,
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
  if (redirects.length) {
    // The final address is crawled as a page of its own.
    await response.body?.cancel();
    return page;
  }
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("html")) {
    await response.body?.cancel();
    return page;
  }
  page.html = true;
  if (response.headers.get("x-robots-tag")?.toLowerCase().includes("noindex")) page.noindex = true;
  const links = new Set<string>();
  const httpLinks = new Set<string>();
  let titleText = "";
  let inTitle = false;
  const rewriter = new HTMLRewriter()
    .on("title", {
      element(el) {
        inTitle = true;
        el.onEndTag(() => {
          inTitle = false;
        });
      },
      text(chunk) {
        if (inTitle) titleText += chunk.text;
      },
    })
    .on("meta", {
      element(el) {
        const name = el.getAttribute("name")?.toLowerCase();
        const content = el.getAttribute("content") ?? "";
        if (name === "description") page.description = content.trim();
        if (name === "robots" && content.toLowerCase().includes("noindex")) page.noindex = true;
      },
    })
    .on("link", {
      element(el) {
        if (el.getAttribute("rel")?.toLowerCase().split(/\s+/).includes("canonical")) {
          page.canonical = el.getAttribute("href");
        }
      },
    })
    .on("h1", {
      element() {
        page.h1++;
      },
    })
    .on("img", {
      element(el) {
        if (el.getAttribute("alt") === null) page.imagesWithoutAlt++;
      },
    })
    .on("a[href]", {
      element(el) {
        const href = el.getAttribute("href") ?? "";
        const target = internalUrl(href, url, domain);
        if (!target) return;
        if (target.protocol === "http:") {
          httpLinks.add(target.toString());
          target.protocol = "https:";
        }
        if (links.size < MAX_LINKS) links.add(target.toString());
      },
    });
  const reader = rewriter.transform(response).body?.getReader();
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      page.bytes += value.byteLength;
      if (page.bytes > MAX_HTML_BYTES * 2) {
        await reader.cancel();
        break;
      }
    }
  }
  page.title = titleText.trim() || null;
  page.links = [...links];
  page.httpLinks = [...httpLinks];
  return page;
}
