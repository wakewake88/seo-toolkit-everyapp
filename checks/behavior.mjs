import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { createProject, withFakes } from "./fakes.mjs";

const poll = { timeout: 45_000, intervals: [500, 1000] };

// Search data and the crawled site come from local fakes (checks/fakes.mjs).
const runtime = await startRuntime(withFakes());
try {
  const context = await runtime.context("owner");
  const page = await context.newPage();

  // F001: projects. The domain is normalized to its host; bad ones are refused.
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  await runtime.assertBackLink(page);
  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Broken");
  await dialog.getByLabel("Domain").fill("not a domain");
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog.getByText("Enter a domain such as example.com")).toBeVisible();
  await page.keyboard.press("Escape");
  const projectId = await createProject(page, expect, "Fernleaf Gardens", "https://www.fernleafgardens.com/shop?ref=1");
  await expect(page.getByTestId("project-domain")).toHaveText("fernleafgardens.com");

  // F004: rank tracking, on demand, for the project and a competitor.
  await page.getByLabel("Keywords to track").fill("heirloom tomato seeds\nseed starting soil\nperennial seeds\nheirloom tomato seeds");
  await page.getByRole("button", { name: "Track keywords" }).click();
  await expect(page.getByTestId("tracked-row")).toHaveCount(3);
  await page.getByLabel("Competitor domain").fill("rootandbloom.com");
  await page.getByRole("button", { name: "Add competitor" }).click();
  await expect(page.getByTestId("competitor-chip").filter({ hasText: "rootandbloom.com" })).toBeVisible();

  const doneRuns = async () => (await (await runtime.database()).prepare("SELECT COUNT(*) AS n FROM rank_runs WHERE project_id = ? AND status = 'done'").bind(projectId).first()).n;
  const runCheck = async () => {
    const before = await doneRuns();
    await page.getByRole("button", { name: "Check now" }).click();
    await expect.poll(doneRuns, poll).toBe(before + 1);
    await page.reload();
    await expect(page.getByTestId("check-status")).toContainText("Last checked");
  };
  await runCheck();
  const tomato = page.getByTestId("tracked-row").filter({ hasText: "heirloom tomato seeds" });
  await expect(tomato.getByTestId("position")).toHaveText(/^\d+$/);
  await expect(tomato.getByRole("link", { name: /fernleafgardens\.com\/heirloom-tomato-seeds/ })).toBeVisible();
  await expect(tomato.getByTestId("owned-features")).toContainText("Featured snippet");
  await expect(page.getByTestId("visibility")).toHaveText(/^\d+(\.\d)?%$/);
  await runCheck();
  await expect(tomato.getByTestId("change")).toHaveText(/^\+\d+$/);
  const versus = page.getByTestId("competitor-table");
  await expect(versus.getByRole("columnheader", { name: "rootandbloom.com" })).toBeVisible();
  await expect(versus.getByRole("row").filter({ hasText: "seed starting soil" })).toContainText(/\d/);
  await expect(page.getByTestId("history-chart")).toBeVisible();
  await page.getByRole("button", { name: "Stop tracking perennial seeds" }).click();
  await expect(page.getByTestId("tracked-row")).toHaveCount(2);

  // The daily schedule checks every project's keywords on its own.
  const runs = async () => (await (await runtime.database()).prepare("SELECT COUNT(*) AS n FROM rank_runs WHERE project_id = ?").bind(projectId).first()).n;
  const before = await runs();
  await runtime.scheduled("0 6 * * *");
  await expect.poll(runs, poll).toBe(before + 1);

  // F002: keyword research with filters, sorting, the top 10 and saved lists.
  await page.goto("/keywords");
  await page.getByLabel("Seed keyword").fill("seeds");
  await page.getByRole("button", { name: "Find keywords" }).click();
  const ideas = page.getByTestId("idea-row");
  await expect(ideas).toHaveCount(8);
  await expect(ideas.filter({ hasText: "heirloom tomato seeds" })).toContainText("9,900");
  await page.getByRole("button", { name: "Sort by volume" }).click();
  await expect(ideas.first()).toContainText("how to start seeds indoors");
  await page.getByLabel("Include word").fill("tomato");
  await expect(ideas).toHaveCount(1);
  await page.getByLabel("Include word").fill("");
  await page.getByLabel("Exclude word").fill("seed");
  await expect(ideas).toHaveCount(0);
  await page.getByLabel("Exclude word").fill("");
  await page.getByLabel("Minimum volume").fill("9000");
  await expect(ideas).toHaveCount(3);
  await page.getByLabel("Maximum difficulty").fill("40");
  await expect(ideas).toHaveCount(2);
  await page.getByLabel("Minimum volume").fill("");
  await page.getByLabel("Maximum difficulty").fill("");
  await expect(ideas).toHaveCount(8);

  await ideas.filter({ hasText: "heirloom tomato seeds" }).getByRole("button", { name: "heirloom tomato seeds" }).click();
  const serp = page.getByRole("dialog");
  await expect(serp.getByTestId("serp-row")).toHaveCount(10);
  await expect(serp.getByTestId("serp-features")).toContainText("Featured snippet");
  await expect(serp.getByTestId("serp-row").filter({ hasText: "rootandbloom.com" })).toHaveCount(1);
  await page.keyboard.press("Escape");

  await page.getByRole("checkbox", { name: "Select heirloom tomato seeds" }).click();
  await page.getByRole("checkbox", { name: "Select seed starting soil" }).click();
  const saveTo = async (list) => {
    await page.getByRole("button", { name: "Save to list" }).click();
    const save = page.getByRole("dialog");
    await save.getByLabel("List name").fill(list);
    await save.getByRole("button", { name: "Save keywords" }).click();
  };
  await saveTo("Tomatoes and soil");
  await expect(page.getByText("Saved 2 keywords to Tomatoes and soil")).toBeVisible();
  await saveTo("Tomatoes and soil");
  await expect(page.getByText("Both were already in Tomatoes and soil")).toBeVisible();

  // F003: domain overview and keyword gap.
  await page.goto("/domains");
  await page.getByLabel("Domain").fill("fernleafgardens.com");
  await page.getByRole("button", { name: "Analyze" }).click();
  await expect(page.getByTestId("ranking-keywords")).toHaveText("1,284");
  await expect(page.getByTestId("organic-traffic")).toHaveText("9,310");
  await expect(page.getByTestId("top-keyword-row")).toHaveCount(3);
  await expect(page.getByTestId("top-keyword-row").first()).toContainText("heirloom tomato seeds");
  await expect(page.getByTestId("competitor-row").filter({ hasText: "rootandbloom.com" })).toContainText("412");
  await expect(page.getByTestId("competitor-row").filter({ hasText: /^fernleafgardens\.com/ })).toHaveCount(0);

  await page.getByRole("tab", { name: "Keyword gap" }).click();
  await page.getByLabel("Competitor 1").fill("rootandbloom.com");
  await page.getByLabel("Competitor 2").fill("gardenmentor.org");
  await page.getByRole("button", { name: "Compare" }).click();
  const gap = page.getByTestId("gap-row");
  await expect(gap).toHaveCount(4);
  await expect(gap.filter({ hasText: "raised bed kits" })).toContainText("9");
  await page.getByRole("tab", { name: /^Weaker/ }).click();
  await expect(gap).toHaveCount(2);
  await page.getByRole("tab", { name: /^Shared/ }).click();
  await expect(gap).toHaveCount(3);
  await page.getByRole("tab", { name: /^Missing/ }).click();
  await page.getByRole("checkbox", { name: "Select raised bed kits" }).click();
  await saveTo("Gap ideas");
  await expect(page.getByText("Saved 1 keyword to Gap ideas")).toBeVisible();

  // Saved lists: view, export as CSV, delete.
  await page.goto(`/projects/${projectId}/lists`);
  const tomatoes = page.getByTestId("keyword-list").filter({ hasText: "Tomatoes and soil" });
  await expect(tomatoes.getByTestId("saved-keyword-row")).toHaveCount(2);
  await expect(page.getByTestId("keyword-list").filter({ hasText: "Gap ideas" }).getByTestId("saved-keyword-row")).toHaveCount(1);
  const [download] = await Promise.all([page.waitForEvent("download"), tomatoes.getByRole("button", { name: "Export CSV" }).click()]);
  const csv = await (await download.createReadStream()).toArray();
  expect(Buffer.concat(csv).toString()).toMatch(/keyword,volume,difficulty,cpc,intent[\s\S]*heirloom tomato seeds,9900,31/);
  await tomatoes.getByRole("button", { name: "Delete seed starting soil" }).click();
  await expect(tomatoes.getByTestId("saved-keyword-row")).toHaveCount(1);

  // F006: backlinks, referring domains and the gap.
  await page.goto("/backlinks");
  await page.getByLabel("Domain").fill("fernleafgardens.com");
  await page.getByRole("button", { name: "Analyze" }).click();
  await expect(page.getByTestId("total-backlinks")).toHaveText("2,873");
  await expect(page.getByTestId("referring-domains")).toHaveText("164");
  await expect(page.getByTestId("authority-rank")).toHaveText("311");
  const links = page.getByTestId("backlink-row");
  await expect(links).toHaveCount(50);
  await expect(page.getByTestId("backlink-page")).toHaveText("1–50 of 130");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByTestId("backlink-page")).toHaveText("51–100 of 130");
  await page.getByRole("button", { name: "Nofollow", exact: true }).click();
  await expect(page.getByTestId("backlink-page")).toHaveText("1–44 of 44");
  await expect(links.first()).toContainText("nofollow");
  await page.getByRole("tab", { name: "Referring domains" }).click();
  await expect(page.getByTestId("referring-row")).toHaveCount(2);
  await expect(page.getByTestId("referring-row").first()).toContainText("gardenersdigest.com");
  await page.getByRole("tab", { name: "Backlink gap" }).click();
  await page.getByLabel("Competitor 1").fill("rootandbloom.com");
  await page.getByLabel("Competitor 2").fill("gardenmentor.org");
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByTestId("backlink-gap-row")).toHaveCount(3);
  await expect(page.getByTestId("backlink-gap-row").filter({ hasText: "gardenersdigest.com" })).toHaveCount(0);

  // F005: site audit in the background, obeying robots.txt.
  await page.goto(`/projects/${projectId}/audit`);
  await page.getByRole("button", { name: "Start audit" }).click();
  await expect(page.getByRole("button", { name: "Start audit" })).toBeDisabled();
  await expect(async () => {
    await page.reload();
    await expect(page.getByTestId("audit-status")).toHaveText("Done", { timeout: 1000 });
  }).toPass(poll);
  await expect(page.getByTestId("health-score")).toHaveText(/^\d{1,3}$/);
  const issues = page.getByTestId("issue-row");
  for (const title of ["4xx or 5xx status", "Broken internal link", "Redirect chain", "Duplicate title", "Missing meta description", "Multiple H1", "Image without alt text", "Noindex page", "Missing canonical", "Link to HTTP page", "AI crawlers blocked"]) {
    await expect(issues.filter({ hasText: title })).toHaveCount(1);
  }
  await expect(issues.first()).toContainText("Error");
  await issues.filter({ hasText: "Multiple H1" }).getByRole("button").click();
  await expect(page.getByTestId("affected-page").filter({ hasText: "/about" })).toBeVisible();
  const pages = page.getByTestId("page-row");
  await expect(pages.filter({ hasText: "fernleafgardens.com/store" })).toBeVisible();
  await expect(pages.filter({ hasText: "/private/" })).toHaveCount(0);
  await page.getByRole("switch", { name: "Rerun weekly" }).click();
  await expect(page.getByRole("switch", { name: "Rerun weekly" })).toBeChecked();
  await runtime.scheduled("0 4 * * 1");
  await expect(async () => {
    await page.reload();
    await expect(page.getByTestId("audit-history-row")).toHaveCount(2, { timeout: 1000 });
    await expect(page.getByTestId("audit-status")).toHaveText("Done", { timeout: 1000 });
  }).toPass(poll);

  // A crawl that can't reach the site fails with a reason; settings rename, re-point and delete.
  const otherId = await createProject(page, expect, "Old Blog", "offline.example");
  await page.goto(`/projects/${otherId}/audit`);
  await page.getByRole("button", { name: "Start audit" }).click();
  await expect(async () => {
    await page.reload();
    await expect(page.getByTestId("audit-status")).toContainText("Failed", { timeout: 1000 });
  }).toPass(poll);
  await expect(page.getByTestId("audit-status")).toContainText("offline.example");
  await page.goto(`/projects/${otherId}/settings`);
  await page.getByLabel("Name").fill("Archived Blog");
  await page.getByLabel("Domain").fill("http://archive.example/home");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Archived Blog" })).toBeVisible();
  await expect(page.getByTestId("project-domain")).toHaveText("archive.example");
  await page.getByRole("button", { name: "Delete project" }).click();
  await Promise.all([page.waitForURL((url) => url.pathname === "/"), page.getByRole("alertdialog").getByRole("button", { name: "Delete project" }).click()]);
  await expect(page.getByTestId("project-row")).toHaveCount(1);
  const leftovers = await (await runtime.database()).prepare("SELECT COUNT(*) AS n FROM audits WHERE project_id = ?").bind(otherId).first();
  expect(leftovers.n).toBe(0);

  // The list shows each project's tracking and audit summary.
  const row = page.getByTestId("project-row").filter({ hasText: "Fernleaf Gardens" });
  await expect(row).toContainText("2 keywords");
  await expect(row.getByTestId("project-score")).toHaveText(/^\d{1,3}$/);

  // The journey ends on the rankings, the result people come for.
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByTestId("tracked-row")).toHaveCount(2);
  await runtime.screenshot(page);

  // Phone-sized smoke.
  const phone = await (await runtime.context("member", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("/");
  await expect(phone.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  await expect(phone.getByRole("button", { name: "New project" })).toBeVisible();
  await runtime.assertBackLink(phone);
} finally {
  await runtime.close();
}

// Without the search-data feature the data screens say so; projects and audits still work.
const bare = await startRuntime();
try {
  const page = await (await bare.context("member")).newPage();
  for (const path of ["/keywords", "/domains", "/backlinks"]) {
    await page.goto(path);
    await expect(page.getByTestId("searchdata-off")).toContainText("Search data isn't set up");
  }
  const id = await createProject(page, expect, "Hillside Bakery", "hillsidebakery.com");
  await expect(page.getByTestId("searchdata-off")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check now" })).toBeDisabled();
  await page.goto(`/projects/${id}/audit`);
  await expect(page.getByRole("button", { name: "Start audit" })).toBeEnabled();
} finally {
  await bare.close();
}
console.log("behavior: ok");
