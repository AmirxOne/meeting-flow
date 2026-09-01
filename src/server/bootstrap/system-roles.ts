import { prisma } from "@/server/db";

const PERM = {
  MEETING: [
    "meeting:create", "meeting:view", "meeting:view-all", "meeting:update",
    "meeting:approve", "meeting:reject", "meeting:cancel", "meeting:reschedule",
    "meeting:change-room", "meeting:add-participant", "meeting:remove-participant",
    "meeting:start", "meeting:end", "meeting:extend", "meeting:manage-guests",
  ],
  ROOM: ["room:create", "room:update", "room:disable", "room:delete"],
  BRANCH: ["branch:create", "branch:update"],
  USER: ["user:create", "user:update", "user:disable", "user:reset-password", "role:manage"],
  REPORT: ["report:view", "audit:view"],
  SETTINGS: ["policy:manage", "org:manage"],
};

const USER_ADMIN = ["user:create", "user:update", "user:disable", "user:reset-password"];

const ROLES: { key: string; name: string; description: string; perms: string[] }[] = [
  { key: "SUPER_ADMIN", name: "مدیر پلتفرم", description: "مدیر پلتفرم — همه سازمان‌ها", perms: [...PERM.MEETING, ...PERM.ROOM, ...PERM.BRANCH, ...PERM.USER, ...PERM.REPORT, ...PERM.SETTINGS] },
  { key: "ADMIN", name: "مدیر سازمان", description: "مدیریت کامل سازمان", perms: [...PERM.MEETING, ...PERM.ROOM, ...PERM.BRANCH, ...USER_ADMIN, ...PERM.REPORT, ...PERM.SETTINGS] },
  { key: "MEETING_OPERATOR", name: "اپراتور جلسات", description: "تأیید درخواست‌های جلسه", perms: [...PERM.MEETING, "report:view"] },
  { key: "BRANCH_MANAGER", name: "مدیر شعبه", description: "مدیریت شعبه و اتاق‌ها", perms: ["meeting:view", "meeting:view-all", "meeting:create", "meeting:update", "meeting:cancel", "meeting:reschedule", "meeting:change-room", "meeting:add-participant", "meeting:remove-participant", "room:create", "room:update", "room:disable", "report:view", "audit:view"] },
  { key: "ROOM_MANAGER", name: "مدیر اتاق", description: "مدیریت اتاق‌ها", perms: ["meeting:view", "meeting:view-all", "room:update", "room:disable", "report:view"] },
  { key: "EMPLOYEE", name: "کارمند", description: "ایجاد جلسه و تقویم شخصی", perms: ["meeting:view", "meeting:create", "meeting:update"] },
];

const PERM_NAME_FA: Record<string, string> = {
  "meeting:create": "ایجاد جلسه", "meeting:view": "مشاهده جلسات", "meeting:view-all": "مشاهده همه جلسات",
  "meeting:update": "ویرایش جلسه", "meeting:approve": "تأیید جلسه", "meeting:reject": "رد جلسه",
  "meeting:cancel": "لغو جلسه", "meeting:reschedule": "زمان‌بندی مجدد", "meeting:change-room": "تغییر اتاق",
  "meeting:add-participant": "افزودن مشارکت‌کننده", "meeting:remove-participant": "حذف مشارکت‌کننده",
  "meeting:start": "شروع جلسه", "meeting:end": "پایان جلسه", "meeting:extend": "تمدید جلسه",
  "meeting:manage-guests": "مدیریت مهمان‌ها", "room:create": "ایجاد اتاق", "room:update": "ویرایش اتاق",
  "room:disable": "غیرفعال‌سازی اتاق", "room:delete": "حذف اتاق", "branch:create": "ایجاد شعبه",
  "branch:update": "ویرایش شعبه", "user:create": "ایجاد کاربر", "user:update": "ویرایش کاربر",
  "user:disable": "غیرفعال‌سازی کاربر", "user:reset-password": "بازنشانی رمز", "role:manage": "مدیریت نقش‌ها",
  "report:view": "مشاهده گزارش‌ها", "audit:view": "مشاهده لاگ ممیزی", "policy:manage": "مدیریت سیاست‌ها",
  "org:manage": "مدیریت سازمان",
};

/** Idempotent RBAC seed — safe on empty DB before first org bootstrap. */
export async function ensureSystemRoles(): Promise<void> {
  const allPermKeys = new Set<string>();
  for (const r of ROLES) r.perms.forEach((p) => allPermKeys.add(p));

  for (const key of allPermKeys) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: {
        key,
        name: PERM_NAME_FA[key] ?? key,
        group:
          key.split(":")[0] === "meeting"
            ? "جلسات"
            : key.split(":")[0] === "room"
              ? "اتاق‌ها"
              : key.split(":")[0] === "user" || key.split(":")[0] === "role"
                ? "کاربران"
                : key.split(":")[0] === "branch"
                  ? "سازمان"
                  : "سایر",
      },
    });
  }

  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name, description: r.description },
      create: { key: r.key, name: r.name, description: r.description, isSystem: true },
    });
    const perms = await prisma.permission.findMany({ where: { key: { in: r.perms } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (perms.length) {
      await prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });
    }
  }
}
