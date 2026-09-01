// Central permission catalog — single source of truth.
// Roles reference these keys; backend enforces them on every route.

export const PERMISSIONS = {
  "meeting:create": { name: "ایجاد جلسه", group: "جلسات" },
  "meeting:view": { name: "مشاهده جلسات", group: "جلسات" },
  "meeting:view-all": { name: "مشاهده همه جلسات سازمان", group: "جلسات" },
  "meeting:update": { name: "ویرایش جلسه", group: "جلسات" },
  "meeting:approve": { name: "تأیید جلسه", group: "جلسات" },
  "meeting:reject": { name: "رد جلسه", group: "جلسات" },
  "meeting:cancel": { name: "لغو جلسه", group: "جلسات" },
  "meeting:reschedule": { name: "زمان‌بندی مجدد", group: "جلسات" },
  "meeting:change-room": { name: "تغییر اتاق", group: "جلسات" },
  "meeting:add-participant": { name: "افزودن مشارکت‌کننده", group: "جلسات" },
  "meeting:remove-participant": { name: "حذف مشارکت‌کننده", group: "جلسات" },
  "meeting:start": { name: "شروع جلسه", group: "جلسات" },
  "meeting:end": { name: "پایان جلسه", group: "جلسات" },
  "meeting:extend": { name: "تمدید جلسه", group: "جلسات" },
  "meeting:manage-guests": { name: "مدیریت مهمان‌ها", group: "جلسات" },

  "room:create": { name: "ایجاد اتاق", group: "اتاق‌ها" },
  "room:update": { name: "ویرایش اتاق", group: "اتاق‌ها" },
  "room:disable": { name: "غیرفعال‌سازی اتاق", group: "اتاق‌ها" },
  "room:delete": { name: "حذف اتاق", group: "اتاق‌ها" },

  "branch:create": { name: "ایجاد شعبه", group: "سازمان" },
  "branch:update": { name: "ویرایش شعبه", group: "سازمان" },

  "user:create": { name: "ایجاد کاربر", group: "کاربران" },
  "user:update": { name: "ویرایش کاربر", group: "کاربران" },
  "user:disable": { name: "غیرفعال‌سازی کاربر", group: "کاربران" },
  "user:reset-password": { name: "بازنشانی رمز عبور", group: "کاربران" },

  "role:manage": { name: "مدیریت نقش‌ها", group: "کاربران" },

  "report:view": { name: "مشاهده گزارش‌ها", group: "گزارش‌ها" },
  "audit:view": { name: "مشاهده لاگ ممیزی", group: "گزارش‌ها" },
  "policy:manage": { name: "مدیریت سیاست‌ها", group: "تنظیمات" },
  "org:manage": { name: "مدیریت سازمان", group: "تنظیمات" },
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

// Role definitions (seeded as isSystem). SUPER_ADMIN bypasses checks.
export const ROLE_DEFINITIONS: Record<
  string,
  { name: string; description: string; permissions: PermissionKey[] }
> = {
  SUPER_ADMIN: {
    name: "مدیر پلتفرم",
    description: "مدیر پلتفرم — همه سازمان‌ها (با انتخاب سازمان)",
    permissions: PERMISSION_KEYS,
  },
  ADMIN: {
    name: "مدیر سازمان",
    description: "مدیریت کامل سازمان به جز نقش‌های سیستم",
    permissions: [
      "meeting:view", "meeting:view-all", "meeting:create", "meeting:update",
      "meeting:approve", "meeting:reject", "meeting:cancel", "meeting:reschedule",
      "meeting:change-room", "meeting:add-participant", "meeting:remove-participant",
      "meeting:start", "meeting:end", "meeting:extend", "meeting:manage-guests",
      "room:create", "room:update", "room:disable", "room:delete",
      "branch:create", "branch:update",
      "user:create", "user:update", "user:disable", "user:reset-password",
      "report:view", "audit:view", "policy:manage", "org:manage",
    ],
  },
  MEETING_OPERATOR: {
    name: "اپراتور جلسات",
    description: "بررسی و تأیید درخواست‌های جلسه",
    permissions: [
      "meeting:view", "meeting:view-all", "meeting:create", "meeting:update",
      "meeting:approve", "meeting:reject", "meeting:cancel", "meeting:reschedule",
      "meeting:change-room", "meeting:add-participant", "meeting:remove-participant",
      "meeting:start", "meeting:end", "meeting:extend", "meeting:manage-guests",
      "report:view",
    ],
  },
  BRANCH_MANAGER: {
    name: "مدیر شعبه",
    description: "مدیریت شعبه، اتاق‌ها و گزارش‌ها",
    permissions: [
      "meeting:view", "meeting:view-all", "meeting:create", "meeting:update",
      "meeting:cancel", "meeting:reschedule", "meeting:change-room",
      "meeting:add-participant", "meeting:remove-participant",
      "room:create", "room:update", "room:disable",
      "report:view", "audit:view",
    ],
  },
  ROOM_MANAGER: {
    name: "مدیر اتاق",
    description: "مدیریت اتاق‌های جلسه",
    permissions: [
      "meeting:view", "meeting:view-all",
      "room:update", "room:disable",
      "report:view",
    ],
  },
  EMPLOYEE: {
    name: "کارمند",
    description: "ایجاد جلسه و مشاهده تقویم خود",
    permissions: [
      "meeting:view", "meeting:create", "meeting:update",
    ],
  },
};

export const SYSTEM_ROLE_KEYS = Object.keys(ROLE_DEFINITIONS);
