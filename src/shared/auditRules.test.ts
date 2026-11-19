import { describe, expect, it } from "vitest";
import { blockedAiCrawlers, healthScore, parseRobots, robotsAllows } from "@/shared/auditRules";

const robots = parseRobots(`
User-agent: *
Disallow: /private/
Allow: /private/press

User-agent: GPTBot
User-agent: CCBot
Disallow: /
`);

describe("robots.txt", () => {
  it("applies the longest matching rule of the crawler's group", () => {
    expect(robotsAllows(robots, "SiteHealthCheck", "/")).toBe(true);
    expect(robotsAllows(robots, "SiteHealthCheck", "/private/orders")).toBe(false);
    expect(robotsAllows(robots, "SiteHealthCheck", "/private/press/2026")).toBe(true);
  });
  it("names AI crawlers kept off the whole site", () => {
    expect(blockedAiCrawlers(robots)).toEqual(["GPTBot", "CCBot"]);
    expect(blockedAiCrawlers(parseRobots("User-agent: *\nDisallow:"))).toEqual([]);
  });
});

describe("healthScore", () => {
  it("is 100 with no issues and falls with errors more than notices", () => {
    expect(healthScore(4, [])).toBe(100);
    const notices = healthScore(4, [{ url: "a", severity: "notice" }]);
    const errors = healthScore(4, [{ url: "a", severity: "error" }]);
    expect(notices).toBeGreaterThan(errors);
    expect(healthScore(1, [{ url: "a", severity: "error" }, { url: "a", severity: "error" }])).toBe(0);
  });
});
