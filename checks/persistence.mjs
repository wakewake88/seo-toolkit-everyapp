import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { createProject, withFakes } from "./fakes.mjs";

const runtime = await startRuntime(withFakes());
try {
  let page = await (await runtime.context("owner")).newPage();
  const id = await createProject(page, expect, "Fernleaf Gardens", "fernleafgardens.com");
  await page.getByLabel("Keywords to track").fill("heirloom tomato seeds\nseed starting soil");
  await page.getByRole("button", { name: "Track keywords" }).click();
  await page.getByLabel("Competitor domain").fill("rootandbloom.com");
  await page.getByRole("button", { name: "Add competitor" }).click();
  await expect(page.getByTestId("competitor-chip")).toHaveCount(1);
  await page.getByRole("button", { name: "Check now" }).click();
  await expect(async () => {
    await page.reload();
    await expect(page.getByTestId("check-status")).toContainText("Last checked", { timeout: 1000 });
  }).toPass({ timeout: 45_000 });
  const position = await page.getByTestId("tracked-row").first().getByTestId("position").textContent();

  await runtime.restart();

  page = await (await runtime.context("owner")).newPage();
  await page.goto("/");
  await expect(page.getByTestId("project-row").filter({ hasText: "Fernleaf Gardens" })).toContainText("2 keywords");
  await page.goto(`/projects/${id}`);
  await expect(page.getByTestId("tracked-row")).toHaveCount(2);
  await expect(page.getByTestId("tracked-row").first().getByTestId("position")).toHaveText(position);
  await expect(page.getByTestId("competitor-chip").filter({ hasText: "rootandbloom.com" })).toBeVisible();
  await expect(page.getByTestId("check-status")).toContainText("Last checked");
} finally {
  await runtime.close();
}
console.log("persistence: ok");
