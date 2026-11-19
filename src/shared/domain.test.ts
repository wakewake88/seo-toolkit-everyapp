import { describe, expect, it } from "vitest";
import { normalizeDomain } from "@/shared/domain";

describe("normalizeDomain", () => {
  it("keeps the host of a URL, without www", () => {
    expect(normalizeDomain("https://www.Example.com/shop?x=1")).toBe("example.com");
    expect(normalizeDomain("blog.example.co.uk/path")).toBe("blog.example.co.uk");
    expect(normalizeDomain("http://example.com:8080")).toBe("example.com");
  });
  it("refuses what isn't a domain", () => {
    for (const bad of ["", "not a domain", "localhost", "-bad.com", "example.123", "ftp//x"]) {
      expect(normalizeDomain(bad)).toBeNull();
    }
  });
});
