// Local fakes for the checks: a Gateway that answers DataForSEO calls with
// fixed, realistic data, and a small website for the site audit to crawl.
// Neither ships in the app; they stand in for third parties during checks.

const GATEWAY = String.raw`
let serpCalls = 0;
const ok = (result) => Response.json({ status_code: 20000, tasks: [{ status_code: 20000, status_message: "Ok.", result }] });
const IDEAS = [
  ["organic vegetable seeds", 14800, 38, 1.42, "commercial"],
  ["heirloom tomato seeds", 9900, 31, 0.98, "transactional"],
  ["how to start seeds indoors", 22200, 45, 0.61, "informational"],
  ["seed starting soil", 6600, 27, 1.15, "commercial"],
  ["best seeds for beginners", 3600, 19, 0.74, "informational"],
  ["buy flower seeds online", 2900, 52, 2.31, "transactional"],
  ["perennial seeds", 4400, 22, 0.88, "commercial"],
  ["seed catalog", 8100, 61, 1.67, "navigational"],
];
const SITES = ["gardenmentor.org", "rootandbloom.com", "seedsavers.net", "thegardenhub.com", "growplanner.io", "fernleafgardens.com", "bloomjournal.com", "urbanplot.co", "greenrowfarm.com", "plantdoctor.info", "seedbarn.com", "potting.shed"];
const RANKED = {
  "fernleafgardens.com": [["heirloom tomato seeds", 4, 9900], ["seed starting soil", 12, 6600], ["perennial seeds", 7, 4400]],
  "rootandbloom.com": [["heirloom tomato seeds", 2, 9900], ["organic vegetable seeds", 5, 14800], ["seed starting soil", 18, 6600], ["raised bed kits", 9, 5400]],
  "gardenmentor.org": [["how to start seeds indoors", 1, 22200], ["perennial seeds", 3, 4400], ["companion planting chart", 6, 12100]],
};
const REFERRERS = {
  "fernleafgardens.com": [["gardenersdigest.com", 412, 6], ["localfarmblog.net", 188, 2]],
  "rootandbloom.com": [["gardenersdigest.com", 412, 3], ["homesteadweekly.com", 356, 4], ["seedlibrary.org", 290, 1]],
  "gardenmentor.org": [["homesteadweekly.com", 356, 2], ["growingguide.edu", 521, 5]],
};
export default { async fetch(request) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/integrations/dataforseo") return Response.json({ requested: true, configured: true, ready: true });
  const body = request.method === "POST" ? (await request.json())[0] ?? {} : {};
  const path = url.pathname;
  if (path.endsWith("/keyword_ideas/live")) {
    return ok([{ items: IDEAS.map(([keyword, volume, kd, cpc, intent], i) => ({
      keyword,
      keyword_info: { search_volume: volume, cpc, monthly_searches: Array.from({ length: 12 }, (_, m) => ({ year: 2026, month: 12 - m, search_volume: Math.round(volume * (0.7 + ((m + i) % 5) / 10)) })) },
      keyword_properties: { keyword_difficulty: kd },
      search_intent_info: { main_intent: intent },
    })) }]);
  }
  if (path.endsWith("/organic/live/advanced")) {
    serpCalls++;
    const keyword = body.keyword ?? "";
    // The tracked site climbs one place on every check of the day.
    const own = Math.max(1, 8 - serpCalls) + (keyword.length % 3);
    const order = SITES.filter((s) => s !== "fernleafgardens.com");
    order.splice(own - 1, 0, "fernleafgardens.com");
    const items = [
      { type: "featured_snippet", rank_group: 1, rank_absolute: 1, domain: "fernleafgardens.com", url: "https://fernleafgardens.com/guides/" + keyword.replaceAll(" ", "-") },
      ...order.map((domain, i) => ({ type: "organic", rank_group: i + 1, rank_absolute: i + 2, domain, url: "https://" + domain + "/" + keyword.replaceAll(" ", "-"), title: keyword + " guide" })),
    ];
    return ok([{ keyword, item_types: ["featured_snippet", "organic", "people_also_ask"], items }]);
  }
  if (path.endsWith("/domain_rank_overview/live")) {
    return ok([{ items: [{ metrics: { organic: { count: 1284, etv: 9310.4 } } }] }]);
  }
  if (path.endsWith("/ranked_keywords/live")) {
    const rows = RANKED[body.target] ?? [];
    return ok([{ total_count: rows.length, items: rows.map(([keyword, pos, vol]) => ({
      keyword_data: { keyword, keyword_info: { search_volume: vol } },
      ranked_serp_element: { serp_item: { rank_group: pos, url: "https://" + body.target + "/" + keyword.replaceAll(" ", "-") } },
    })) }]);
  }
  if (path.endsWith("/competitors_domain/live")) {
    return ok([{ items: [
      { domain: body.target, intersections: 1284 },
      { domain: "rootandbloom.com", intersections: 412, avg_position: 11.2, full_domain_metrics: { organic: { count: 3021, etv: 18233 } } },
      { domain: "gardenmentor.org", intersections: 287, avg_position: 14.8, full_domain_metrics: { organic: { count: 5120, etv: 40210 } } },
    ] }]);
  }
  if (path.endsWith("/backlinks/summary/live")) {
    return ok([{ target: body.target, backlinks: 2873, referring_domains: 164, rank: 311 }]);
  }
  if (path.endsWith("/backlinks/backlinks/live")) {
    const all = Array.from({ length: 130 }, (_, i) => ({
      url_from: "https://blog" + i + ".example.org/post-" + i, url_to: "https://" + body.target + "/", anchor: i % 2 ? "seed guide" : "heirloom tomatoes",
      dofollow: i % 3 !== 0, first_seen: "2026-0" + (1 + (i % 9)) + "-12 08:00:00 +00:00",
    }));
    const filters = JSON.stringify(body.filters ?? []);
    const rows = filters.includes("true") ? all.filter((r) => r.dofollow) : filters.includes("false") ? all.filter((r) => !r.dofollow) : all;
    return ok([{ total_count: rows.length, items: rows.slice(body.offset ?? 0, (body.offset ?? 0) + (body.limit ?? 100)) }]);
  }
  if (path.endsWith("/backlinks/referring_domains/live")) {
    const rows = REFERRERS[body.target] ?? [];
    return ok([{ total_count: rows.length, items: rows.map(([domain, rank, backlinks]) => ({ domain, rank, backlinks })) }]);
  }
  return Response.json({ status_code: 40400, status_message: "Not found." }, { status: 404 });
} };`;

const SITE = String.raw`
const page = (title, body, head = "") => "<!doctype html><html><head><title>" + title + "</title>" + head + "</head><body>" + body + "</body></html>";
export default { async fetch(request) {
  const url = new URL(request.url);
  if (url.hostname === "offline.example") throw new Error("connection refused");
  const html = (text, status = 200) => new Response(text, { status, headers: { "content-type": "text/html" } });
  switch (url.pathname) {
    case "/robots.txt": return new Response("User-agent: *\nDisallow: /private/\n\nUser-agent: GPTBot\nDisallow: /\n");
    case "/": return html(page("Fernleaf Gardens", "<h1>Seeds for every garden</h1><a href='/about'>About</a> <a href='/shop'>Shop</a> <a href='/private/orders'>Orders</a> <a href='/missing'>Old page</a> <a href='http://fernleafgardens.com/about'>About (old)</a><img src='/hero.jpg'>", "<meta name='description' content='Seeds and growing guides.'><link rel='canonical' href='https://fernleafgardens.com/'>"));
    case "/about": await new Promise((resolve) => setTimeout(resolve, 2000)); return html(page("Fernleaf Gardens", "<h1>About us</h1><h1>Our story</h1><a href='/'>Home</a>"));
    case "/shop": return Response.redirect("https://fernleafgardens.com/shop/", 301);
    case "/shop/": return Response.redirect("https://fernleafgardens.com/store", 301);
    case "/store": return html(page("Store", "<h1>Store</h1><a href='/'>Home</a>", "<meta name='robots' content='noindex'><meta name='description' content='Our store.'><link rel='canonical' href='https://fernleafgardens.com/store'>"));
    case "/private/orders": return html(page("Orders", "<h1>Orders</h1>"));
    default: return html(page("Not found", "<h1>Not found</h1>"), 404);
  }
} };`;

const worker = (name, contents) => ({ config: { name, compatibilityDate: "2025-09-02", manifest: { mainModule: "index.mjs", modules: { "index.mjs": { type: "esm", contents } } } } });

/** startRuntime options with the search-data fake and the website fake. */
export function withFakes() {
  return {
    workers: [worker("fake-gateway", GATEWAY), worker("fake-site", SITE)],
    bindings: {
      EVERY_APP_GATEWAY: { type: "worker", worker: "fake-gateway" },
      CRAWLER: { type: "worker", worker: "fake-site" },
    },
  };
}

/** Creates a project from the projects page and returns its id. */
export async function createProject(page, expect, name, domain) {
  await page.goto("/");
  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Domain").fill(domain);
  await Promise.all([page.waitForURL(/\/projects\/[^/]+$/), dialog.getByRole("button", { name: "Create project" }).click()]);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return new URL(page.url()).pathname.split("/")[2];
}
