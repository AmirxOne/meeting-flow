import { describe, expect, it } from "vitest";
import {
  normalizeOrgSlug,
  requestedOrgSlug,
  slugFromHost,
  SAMPLE_ORG_SLUG,
} from "@/lib/org-slug";

describe("normalizeOrgSlug", () => {
  it("accepts sample and beta", () => {
    expect(normalizeOrgSlug("Sample")).toBe("sample");
    expect(normalizeOrgSlug("beta")).toBe("beta");
  });

  it("rejects junk", () => {
    expect(normalizeOrgSlug("")).toBeNull();
    expect(normalizeOrgSlug("../x")).toBeNull();
    expect(normalizeOrgSlug("a_b")).toBeNull();
    expect(normalizeOrgSlug("-beta")).toBeNull();
  });
});

describe("slugFromHost", () => {
  it("parses localhost subdomain", () => {
    expect(slugFromHost("beta.localhost:3100")).toBe("beta");
    expect(slugFromHost("sample.localhost")).toBe("sample");
    expect(slugFromHost("localhost:3100")).toBeNull();
  });

  it("parses production-style host", () => {
    expect(slugFromHost("acme.mehrsa.app")).toBe("acme");
    expect(slugFromHost("www.mehrsa.app")).toBeNull();
  });
});

describe("requestedOrgSlug", () => {
  it("prefers header over query, host, cookie", () => {
    expect(
      requestedOrgSlug({
        header: "beta",
        query: "sample",
        host: "gamma.localhost",
        cookie: "delta",
      }),
    ).toBe("beta");
  });

  it("falls through to cookie", () => {
    expect(
      requestedOrgSlug({
        header: null,
        query: null,
        host: "localhost",
        cookie: "sample",
      }),
    ).toBe(SAMPLE_ORG_SLUG);
  });
});
