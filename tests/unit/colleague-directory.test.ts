import { describe, expect, it } from "vitest";
import {
  NO_DEPARTMENT,
  filterColleagues,
  groupColleaguesByBranch,
  matchesColleagueQuery,
  uniqueColleagueOptions,
  type Colleague,
} from "@/lib/colleague-directory";

const ali: Colleague = {
  id: "ali",
  fullName: "علی رضایی",
  jobTitle: "کارشناس فروش",
  department: "فروش",
  branch: { id: "niavaran", name: "شعبه نیاوران" },
  roles: [{ role: { key: "EMPLOYEE", name: "کارمند" } }],
};

const hossein: Colleague = {
  id: "hossein",
  fullName: "حسین کریمی",
  jobTitle: "مدیر شعبه ونک",
  department: null,
  branch: { id: "vanak", name: "شعبه ونک" },
  roles: [{ role: { key: "BRANCH_MANAGER", name: "مدیر شعبه" } }],
};

describe("colleague directory", () => {
  it("matches name, job title, department, role and branch", () => {
    expect(matchesColleagueQuery(ali, "علی")).toBe(true);
    expect(matchesColleagueQuery(ali, "فروش")).toBe(true);
    expect(matchesColleagueQuery(ali, "کارمند")).toBe(true);
    expect(matchesColleagueQuery(ali, "نیاوران")).toBe(true);
    expect(matchesColleagueQuery(ali, "ونک")).toBe(false);
  });

  it("filters by branch, role and empty department", () => {
    const all = [ali, hossein];
    expect(filterColleagues(all, { q: "", branchId: "vanak", roleKey: "", department: "" })).toEqual([
      hossein,
    ]);
    expect(filterColleagues(all, { q: "", branchId: "", roleKey: "EMPLOYEE", department: "" })).toEqual([
      ali,
    ]);
    expect(
      filterColleagues(all, { q: "", branchId: "", roleKey: "", department: NO_DEPARTMENT }),
    ).toEqual([hossein]);
  });

  it("groups by branch with unlabeled last", () => {
    const groups = groupColleaguesByBranch([ali, hossein]);
    expect(groups.map((g) => g.label)).toEqual(["شعبه نیاوران", "شعبه ونک"]);
    expect(groups[0].users).toHaveLength(1);
  });

  it("builds unique filter options", () => {
    const opts = uniqueColleagueOptions([ali, hossein]);
    expect(opts.branches.map((b) => b.value)).toEqual(["niavaran", "vanak"]);
    expect(opts.roles.some((r) => r.value === "EMPLOYEE")).toBe(true);
    expect(opts.departments.some((d) => d.value === "فروش")).toBe(true);
    expect(opts.departments.some((d) => d.value === NO_DEPARTMENT)).toBe(true);
  });
});
