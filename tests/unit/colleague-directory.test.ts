import { describe, expect, it } from "vitest";
import {
  NO_DEPARTMENT,
  filterColleagues,
  groupColleaguesByBranch,
  matchesColleagueQuery,
  uniqueColleagueOptions,
  type Colleague,
  NO_JOB_TITLE,
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

const reza: Colleague = {
  id: "reza",
  fullName: "رضا احمدی",
  jobTitle: "کارشناس فروش",
  department: "فروش",
  branch: { id: "niavaran", name: "شعبه نیاوران" },
  roles: [{ role: { key: "EMPLOYEE", name: "کارمند" } }],
  isActive: false,
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

  it("filters by account status", () => {
    const all = [ali, reza];
    expect(
      filterColleagues(all, { q: "", branchId: "", roleKey: "", department: "", accountStatus: "active" }),
    ).toEqual([ali]);
    expect(
      filterColleagues(all, { q: "", branchId: "", roleKey: "", department: "", accountStatus: "inactive" }),
    ).toEqual([reza]);
    expect(
      filterColleagues(all, { q: "", branchId: "", roleKey: "", department: "", accountStatus: "" }),
    ).toHaveLength(2);
  });

  it("filters by job title and includes بدون سمت option", () => {
    const all = [ali, hossein, reza];
    expect(
      filterColleagues(all, { q: "", branchId: "", roleKey: "", department: "", jobTitle: "مدیر شعبه ونک" }),
    ).toEqual([hossein]);
    expect(filterColleagues(all, { q: "", branchId: "", roleKey: "", department: "", jobTitle: NO_JOB_TITLE })).toEqual([]);
    const opts = uniqueColleagueOptions([hossein, { ...ali, jobTitle: null } as Colleague]);
    expect(opts.jobTitles.some((t) => t.value === NO_JOB_TITLE && t.label === "بدون سمت")).toBe(true);
    expect(opts.jobTitles.some((t) => t.value === "مدیر شعبه ونک")).toBe(true);
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
