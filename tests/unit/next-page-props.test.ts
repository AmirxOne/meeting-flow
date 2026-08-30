import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { queryParam } from "@/lib/next-page-props";

function walkPages(dir: string, acc: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkPages(p, acc);
    else if (ent.name === "page.tsx") acc.push(p);
  }
  return acc;
}

describe("queryParam", () => {
  it("reads a string value", () => {
    expect(queryParam({ from: "availability" }, "from")).toBe("availability");
  });

  it("takes the first value of a repeated key", () => {
    expect(queryParam({ roomId: ["r1", "r2"] }, "roomId")).toBe("r1");
  });

  it("returns null for missing or empty array", () => {
    expect(queryParam({}, "from")).toBeNull();
    expect(queryParam({ roomId: [] }, "roomId")).toBeNull();
  });
});

describe("app page.tsx stay server components", () => {
  const pages = walkPages(join(process.cwd(), "src", "app"));

  it("never marks page.tsx as a client component", () => {
    const clientPages = pages.filter((p) =>
      readFileSync(p, "utf8").trimStart().startsWith('"use client"'),
    );
    expect(clientPages).toEqual([]);
  });

  it("does not pass Promise searchParams into client page modules", () => {
    const offenders: string[] = [];
    for (const page of pages) {
      const client = page.replace(/page\.tsx$/, "page-client.tsx");
      if (!existsSync(client)) continue;
      const src = readFileSync(client, "utf8");
      if (src.includes("Promise<") && src.includes("searchParams")) {
        offenders.push(client);
      }
    }
    expect(offenders).toEqual([]);
  });
});
