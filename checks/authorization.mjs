import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { createProject, withFakes } from "./fakes.mjs";

const runtime = await startRuntime(withFakes());
try {
  // Anonymous callers, other organizations and forged identities are refused.
  await runtime.assertPrivateAccess(["/", "/keywords", "/domains", "/backlinks", "/admin", "/health"]);
  expect(runtime.manifest.public ?? []).toEqual([]);

  // The app serves no sign-in of its own.
  for (const path of ["/login", "/sign-in", "/signup", "/logout", "/api/auth/session"]) {
    expect((await runtime.fetch(path)).status).toBe(401);
    const response = await runtime.fetch(path, { role: "member" });
    expect(response.status).toBe(404);
    expect(await response.text()).not.toMatch(/type="password"/);
  }
  const home = await runtime.fetch("/", { role: "member" });
  expect(home.headers.get("set-cookie")).toBeNull();
  expect(await home.text()).not.toMatch(/type="password"/);

  const owner = await (await runtime.context("owner")).newPage();
  const member = await (await runtime.context("member")).newPage();
  const ownerProject = await createProject(owner, expect, "Fernleaf Gardens", "fernleafgardens.com");
  await owner.getByLabel("Keywords to track").fill("heirloom tomato seeds");
  await owner.getByRole("button", { name: "Track keywords" }).click();
  await expect(owner.getByTestId("tracked-row")).toHaveCount(1);
  const memberProject = await createProject(member, expect, "Hillside Bakery", "hillsidebakery.com");

  // One member never sees another's projects or anything under them.
  await member.goto("/");
  await expect(member.getByTestId("project-row")).toHaveCount(1);
  await expect(member.getByText("Fernleaf Gardens")).toHaveCount(0);
  for (const tab of ["", "/audit", "/lists", "/settings"]) {
    await member.goto(`/projects/${ownerProject}${tab}`);
    await expect(member.getByText("Project not found")).toBeVisible();
    await expect(member.getByText("fernleafgardens.com")).toHaveCount(0);
    await expect(member.getByText("heirloom tomato seeds")).toHaveCount(0);
  }

  // Nor changes them, even by swapping ids in its own requests.
  const swap = async (action) => {
    await member.route("**/_serverFn/**", async (route) => {
      const body = route.request().postData();
      const url = route.request().url().replaceAll(memberProject, ownerProject);
      await route.continue({ url, postData: body ? body.replaceAll(memberProject, ownerProject) : body });
    });
    await action();
    await member.unroute("**/_serverFn/**");
  };
  const ownerRow = async () => (await runtime.database()).prepare("SELECT name, domain FROM projects WHERE id = ?").bind(ownerProject).first();
  await member.goto(`/projects/${memberProject}/settings`);
  await swap(async () => {
    await member.getByLabel("Name").fill("Taken over");
    await member.getByRole("button", { name: "Save changes" }).click();
    await expect(member.getByText("Project not found")).toBeVisible();
  });
  expect(await ownerRow()).toEqual({ name: "Fernleaf Gardens", domain: "fernleafgardens.com" });
  await member.goto(`/projects/${memberProject}/settings`);
  await swap(async () => {
    await member.getByRole("button", { name: "Delete project" }).click();
    await member.getByRole("alertdialog").getByRole("button", { name: "Delete project" }).click();
    await expect(member.getByText("Project not found")).toBeVisible();
  });
  expect(await ownerRow()).not.toBeNull();
  await member.goto(`/projects/${memberProject}`);
  await swap(async () => {
    await member.getByLabel("Keywords to track").fill("free bread");
    await member.getByRole("button", { name: "Track keywords" }).click();
    await expect(member.getByText("Project not found")).toBeVisible();
  });
  await member.goto(`/projects/${memberProject}/audit`);
  await swap(async () => {
    await member.getByRole("button", { name: "Start audit" }).click();
    await expect(member.getByText("Project not found")).toBeVisible();
  });
  const planted = await (await runtime.database()).prepare("SELECT (SELECT COUNT(*) FROM tracked_keywords WHERE project_id = ?1) AS k, (SELECT COUNT(*) FROM audits WHERE project_id = ?1) AS a").bind(ownerProject).first();
  expect(planted).toEqual({ k: 1, a: 0 });

  // Saving research keywords into someone else's project is refused too.
  await member.goto("/domains");
  await member.getByRole("tab", { name: "Keyword gap" }).click();
  await member.getByLabel("Competitor 1").fill("rootandbloom.com");
  await member.getByRole("button", { name: "Compare" }).click();
  await member.getByTestId("gap-row").first().getByRole("checkbox").click();
  await swap(async () => {
    await member.getByRole("button", { name: "Save to list" }).click();
    await member.getByRole("dialog").getByLabel("List name").fill("Stolen");
    await member.getByRole("dialog").getByRole("button", { name: "Save keywords" }).click();
    await expect(member.getByText("Project not found")).toBeVisible();
  });
  const lists = await (await runtime.database()).prepare("SELECT COUNT(*) AS n FROM keyword_lists WHERE project_id = ?").bind(ownerProject).first();
  expect(lists.n).toBe(0);

  // The admin view is for workspace admins only.
  await member.goto("/admin");
  await expect(member.getByText("Only workspace admins can open this page.")).toBeVisible();
  await expect(member.getByTestId("admin-project-row")).toHaveCount(0);
  await member.goto("/");
  await expect(member.getByRole("link", { name: "Admin" })).toHaveCount(0);

  await owner.goto("/admin");
  const rows = owner.getByTestId("admin-project-row");
  await expect(rows).toHaveCount(2);
  const bakery = rows.filter({ hasText: "Hillside Bakery" });
  await expect(bakery).toContainText("member@example.test");
  await bakery.getByRole("button", { name: "Delete Hillside Bakery" }).click();
  await owner.getByRole("alertdialog").getByRole("button", { name: "Delete project" }).click();
  await expect(rows).toHaveCount(1);
  await member.goto("/");
  await expect(member.getByTestId("project-row")).toHaveCount(0);
} finally {
  await runtime.close();
}
console.log("authorization: ok");
