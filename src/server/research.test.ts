import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ env: {} }));
const { keywordGap } = await import("@/server/research");

const k = (keyword: string, position: number, volume = 100) => ({ keyword, position, volume, url: "" });

describe("keywordGap", () => {
  it("sorts competitor keywords into missing, weaker and shared", () => {
    const rows = keywordGap([k("a", 4), k("b", 2)], [[k("a", 1), k("c", 5, 900)], [k("b", 6)]]);
    expect(rows.map((r) => [r.keyword, r.kind, r.own, r.rivals])).toEqual([
      ["c", "missing", null, [5, null]],
      ["a", "weaker", 4, [1, null]],
      ["b", "shared", 2, [null, 6]],
    ]);
  });
});
