export type Colleague = {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  branch: { id: string; name: string } | null;
  roles: { role: { key: string; name: string } }[];
};

export const NO_DEPARTMENT = "__none__";
export const NO_BRANCH = "__none__";

export function matchesColleagueQuery(user: Colleague, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    user.fullName,
    user.jobTitle ?? "",
    user.department ?? "",
    user.branch?.name ?? "",
    ...user.roles.map((r) => r.role.name),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export function filterColleagues(
  users: Colleague[],
  opts: { q: string; branchId: string; roleKey: string; department: string },
): Colleague[] {
  return users.filter((user) => {
    if (!matchesColleagueQuery(user, opts.q)) return false;
    if (opts.branchId && (user.branch?.id ?? "") !== opts.branchId) return false;
    if (opts.roleKey && !user.roles.some((r) => r.role.key === opts.roleKey)) return false;
    if (opts.department === NO_DEPARTMENT) return !user.department;
    if (opts.department && user.department !== opts.department) return false;
    return true;
  });
}

export function groupColleaguesByBranch(users: Colleague[]): {
  key: string;
  label: string;
  users: Colleague[];
}[] {
  const map = new Map<string, { label: string; users: Colleague[] }>();
  for (const user of users) {
    const key = user.branch?.id ?? NO_BRANCH;
    const label = user.branch?.name ?? "بدون شعبه";
    const group = map.get(key);
    if (group) group.users.push(user);
    else map.set(key, { label, users: [user] });
  }
  return [...map.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => {
      if (a.key === NO_BRANCH) return 1;
      if (b.key === NO_BRANCH) return -1;
      return a.label.localeCompare(b.label, "fa");
    });
}

export function uniqueColleagueOptions(users: Colleague[]) {
  const branches = new Map<string, string>();
  const roles = new Map<string, string>();
  const departments = new Map<string, string>();
  let withoutDepartment = 0;

  for (const user of users) {
    if (user.branch) branches.set(user.branch.id, user.branch.name);
    for (const r of user.roles) roles.set(r.role.key, r.role.name);
    if (user.department) departments.set(user.department, user.department);
    else withoutDepartment += 1;
  }

  return {
    branches: [...branches.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fa")),
    roles: [...roles.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fa")),
    departments: [
      ...[...departments.keys()]
        .sort((a, b) => a.localeCompare(b, "fa"))
        .map((name) => ({ value: name, label: name })),
      ...(withoutDepartment > 0 ? [{ value: NO_DEPARTMENT, label: "بدون واحد" }] : []),
    ],
  };
}
