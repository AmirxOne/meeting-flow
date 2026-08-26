/* Seed: organization, branches, rooms, users (all roles), sample meetings. */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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

const ROLES: { key: string; name: string; description: string; perms: string[] }[] = [
  { key: "SUPER_ADMIN", name: "مدیر ارشد سیستم", description: "دسترسی کامل", perms: [...PERM.MEETING, ...PERM.ROOM, ...PERM.BRANCH, ...PERM.USER, ...PERM.REPORT, ...PERM.SETTINGS] },
  { key: "ADMIN", name: "مدیر سیستم", description: "مدیریت کامل به جز نقش‌ها", perms: [...PERM.MEETING, ...PERM.ROOM, ...PERM.BRANCH, ...PERM.USER, ...PERM.REPORT, ...PERM.SETTINGS] },
  { key: "MEETING_OPERATOR", name: "اپراتور جلسات", description: "تأیید درخواست‌های جلسه", perms: [...PERM.MEETING, "report:view"] },
  { key: "BRANCH_MANAGER", name: "مدیر شعبه", description: "مدیریت شعبه و اتاق‌ها", perms: ["meeting:view", "meeting:view-all", "meeting:create", "meeting:update", "meeting:cancel", "meeting:reschedule", "meeting:change-room", "meeting:add-participant", "meeting:remove-participant", "room:create", "room:update", "room:disable", "report:view", "audit:view"] },
  { key: "ROOM_MANAGER", name: "مدیر اتاق", description: "مدیریت اتاق‌ها", perms: ["meeting:view", "meeting:view-all", "room:update", "room:disable", "report:view"] },
  { key: "EMPLOYEE", name: "کارمند", description: "ایجاد جلسه و تقویم شخصی", perms: ["meeting:view", "meeting:create", "meeting:update"] },
];

async function main() {
  console.log("🌱 Seeding...");

  // permissions
  const allPermKeys = new Set<string>();
  for (const r of ROLES) r.perms.forEach((p) => allPermKeys.add(p));
  const permNameFa: Record<string, string> = {
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
  for (const key of allPermKeys) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: {
        key,
        name: permNameFa[key] ?? key,
        group: key.split(":")[0] === "meeting" ? "جلسات" : key.split(":")[0] === "room" ? "اتاق‌ها" : key.split(":")[0] === "user" || key.split(":")[0] === "role" ? "کاربران" : key.split(":")[0] === "branch" ? "سازمان" : "سایر",
      },
    });
  }

  // roles
  for (const r of ROLES) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name, description: r.description },
      create: { key: r.key, name: r.name, description: r.description, isSystem: true },
    });
    const perms = await prisma.permission.findMany({ where: { key: { in: r.perms } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
  }

  // org + branches
  const org = await prisma.organization.upsert({
    where: { id: "org-main" },
    update: { name: "شرکت نمونه" },
    create: { id: "org-main", name: "شرکت نمونه", legalName: "شرکت نمونه سهامی خاص", timezone: "Asia/Tehran" },
  });

  const branch1 = await prisma.branch.upsert({
    where: { id: "branch-niavaran" },
    update: {},
    create: { orgId: org.id, id: "branch-niavaran", name: "شعبه نیاوران", address: "تهران، نیاوران، خیابان باهنر", phone: "021-22223344" },
  });
  const branch2 = await prisma.branch.upsert({
    where: { id: "branch-vanak" },
    update: {},
    create: { orgId: org.id, id: "branch-vanak", name: "شعبه ونک", address: "تهران، ونک، خیابان ملاصدرا", phone: "021-88776655" },
  });

  // floors
  const f1 = await prisma.floor.upsert({
    where: { branchId_number: { branchId: branch1.id, number: 1 } },
    update: {},
    create: { branchId: branch1.id, name: "طبقه اول", number: 1 },
  });
  const f2 = await prisma.floor.upsert({
    where: { branchId_number: { branchId: branch1.id, number: 2 } },
    update: {},
    create: { branchId: branch1.id, name: "طبقه دوم", number: 2 },
  });
  const f3 = await prisma.floor.upsert({
    where: { branchId_number: { branchId: branch2.id, number: 3 } },
    update: {},
    create: { branchId: branch2.id, name: "طبقه سوم", number: 3 },
  });

  // rooms
  const roomDefs = [
    { id: "room-a", name: "اتاق جلسه آریا", branchId: branch1.id, floorId: f1.id, capacity: 8, equipment: ["PROJECTOR", "WHITEBOARD"], openTime: "08:00", closeTime: "20:00" },
    { id: "room-b", name: "اتاق کنفرانس بزرگ", branchId: branch1.id, floorId: f2.id, capacity: 20, equipment: ["PROJECTOR", "VIDEO_CONFERENCE", "AUDIO_SYSTEM", "MICROPHONE"], isVip: true, openTime: "09:00", closeTime: "19:00" },
    { id: "room-c", name: "اتاق مدیریت", branchId: branch1.id, floorId: f2.id, capacity: 6, equipment: ["TV", "WHITEBOARD"], isVip: true, openTime: "08:00", closeTime: "20:00" },
    { id: "room-d", name: "اتاق جلسه دانا", branchId: branch2.id, floorId: f3.id, capacity: 10, equipment: ["TV", "VIDEO_CONFERENCE"], openTime: "08:00", closeTime: "20:00" },
  ];
  for (const r of roomDefs) {
    await prisma.meetingRoom.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id, branchId: r.branchId, floorId: r.floorId, name: r.name,
        capacity: r.capacity, isVip: r.isVip ?? false, openTime: r.openTime, closeTime: r.closeTime,
      },
    });
    await prisma.roomEquipment.deleteMany({ where: { roomId: r.id } });
    await prisma.roomEquipment.createMany({
      data: (r.equipment as string[]).map((e) => ({ roomId: r.id, equipment: e })),
    });
  }

  // users
  const password = await bcrypt.hash("Pass1234", 10);
  const users = [
    { email: "admin@example.com", fullName: "علیرضا محمدی", jobTitle: "مدیر سیستم", roleKeys: ["ADMIN"], branchId: branch1.id },
    { email: "operator@example.com", fullName: "مریم احمدی", jobTitle: "اپراتور جلسات", roleKeys: ["MEETING_OPERATOR"], branchId: branch1.id },
    { email: "manager@example.com", fullName: "حسین کریمی", jobTitle: "مدیر شعبه ونک", roleKeys: ["BRANCH_MANAGER"], branchId: branch2.id },
    { email: "room@example.com", fullName: "سارا موسوی", jobTitle: "مسئول اتاق‌ها", roleKeys: ["ROOM_MANAGER"], branchId: branch1.id },
    { email: "ali@example.com", fullName: "علی رضایی", jobTitle: "کارشناس فروش", department: "فروش", roleKeys: ["EMPLOYEE"], branchId: branch1.id },
    { email: "amir@example.com", fullName: "امیر حسینی", jobTitle: "کارشناس بازاریابی", department: "بازاریابی", roleKeys: ["EMPLOYEE"], branchId: branch1.id },
    { email: "sara@example.com", fullName: "سارا نجفی", jobTitle: "مدیر منابع انسانی", department: "منابع انسانی", roleKeys: ["EMPLOYEE", "BRANCH_MANAGER"], branchId: branch1.id },
  ];
  const userIds: Record<string, string> = {};
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.fullName, jobTitle: u.jobTitle, branchId: u.branchId },
      create: {
        email: u.email, fullName: u.fullName, passwordHash: password,
        jobTitle: u.jobTitle, department: u.department ?? null, branchId: u.branchId,
      },
    });
    userIds[u.email] = user.id;
    const roles = await prisma.role.findMany({ where: { key: { in: u.roleKeys } } });
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.createMany({
      data: roles.map((r) => ({ userId: user.id, roleId: r.id })),
    });
  }

  // branch managers
  await prisma.branch.update({
    where: { id: branch2.id },
    data: { managerId: userIds["manager@example.com"] },
  });
  await prisma.branch.update({
    where: { id: branch1.id },
    data: { managerId: userIds["sara@example.com"] },
  });

  // policies
  const policies = [
    { key: "requireApprovalExternalGuest", value: true, description: "جلسه با مهمان خارجی نیاز به تأیید دارد" },
    { key: "requireApprovalVipRoom", value: true, description: "اتاق VIP نیاز به تأیید دارد" },
    { key: "requireApprovalLongerThanMin", value: 120, description: "جلسه بیش از ۲ ساعت نیاز به تأیید دارد" },
    { key: "autoApproveInternal", value: true, description: "جلسه داخلی خودکار تأیید شود" },
    { key: "minDurationMin", value: 15, description: "حداقل مدت جلسه (دقیقه)" },
    { key: "maxDurationMin", value: 480, description: "حداکثر مدت جلسه (دقیقه)" },
    { key: "defaultReminderOffsets", value: [30, 10], description: "یادآورها (دقیقه قبل)" },
  ];
  for (const p of policies) {
    await prisma.meetingPolicy.upsert({
      where: { orgId_key: { orgId: org.id, key: p.key } },
      update: { value: p.value, description: p.description },
      create: { orgId: org.id, key: p.key, value: p.value as object, description: p.description, updatedBy: userIds["admin@example.com"] },
    });
  }

  // sample meetings — today & coming days (Tehran local → UTC via -3:30)
  const nowTehran = new Date(Date.now() + 210 * 60000);
  const todayStartUtc = new Date(
    Date.UTC(nowTehran.getUTCFullYear(), nowTehran.getUTCMonth(), nowTehran.getUTCDate()) - 210 * 60000,
  );
  const at = (dayOffset: number, hour: number, minute = 0) =>
    new Date(todayStartUtc.getTime() + dayOffset * 86400000 + hour * 3600000 + minute * 60000);

  // wipe previous sample meetings (idempotent seed)
  await prisma.meeting.deleteMany({ where: { id: { startsWith: "seed-meeting" } } });

  const meetings = [
    {
      id: "seed-meeting-1", title: "جلسه هفتگی تیم فروش", organizerId: userIds["ali@example.com"],
      branchId: branch1.id, roomId: "room-a", startAt: at(0, 10), endAt: at(0, 11),
      status: "CONFIRMED", meetingType: "INTERNAL",
      participants: [userIds["amir@example.com"], userIds["sara@example.com"]],
    },
    {
      id: "seed-meeting-2", title: "مصاحبه استخدامی — توسعه‌دهنده فرانت‌اند", organizerId: userIds["sara@example.com"],
      branchId: branch1.id, roomId: "room-c", startAt: at(0, 12), endAt: at(0, 13),
      status: "CONFIRMED", meetingType: "INTERVIEW",
      participants: [userIds["admin@example.com"]],
      guests: [{ name: "مهدی کاظمی", company: "شرکت دیگر", phone: "0912*****67", email: "" }],
    },
    {
      id: "seed-meeting-3", title: "ارائه به مشتری — پروژه اتوماسیون", organizerId: userIds["manager@example.com"],
      branchId: branch2.id, roomId: "room-d", startAt: at(1, 9), endAt: at(1, 11),
      status: "PENDING_APPROVAL", meetingType: "CLIENT",
      participants: [userIds["ali@example.com"]],
      guests: [{ name: "مهندس تهرانی", company: "صنایع نمونه", phone: "0913***8890", email: "tehrani@sample.ir" }],
    },
    {
      id: "seed-meeting-4", title: "بازبینی بودجه فصل", organizerId: userIds["admin@example.com"],
      branchId: branch1.id, roomId: "room-b", startAt: at(1, 14), endAt: at(1, 16),
      status: "CONFIRMED", meetingType: "GROUP",
      participants: [userIds["manager@example.com"], userIds["sara@example.com"], userIds["operator@example.com"]],
    },
    {
      id: "seed-meeting-5", title: "جلسه سریع هم‌راستایی", organizerId: userIds["amir@example.com"],
      branchId: branch1.id, roomId: "room-a", startAt: at(2, 15), endAt: new Date(at(2, 15).getTime() + 30 * 60000),
      status: "CONFIRMED", meetingType: "QUICK",
      participants: [userIds["ali@example.com"]],
    },
    {
      id: "seed-meeting-6", title: "جلسه گذشته (تمام‌شده)", organizerId: userIds["sara@example.com"],
      branchId: branch1.id, roomId: "room-a", startAt: at(-2, 10), endAt: at(-2, 11),
      status: "COMPLETED", meetingType: "INTERNAL",
      participants: [userIds["ali@example.com"], userIds["amir@example.com"]],
    },
    {
      id: "seed-meeting-7", title: "جلسه لغو شده نمونه", organizerId: userIds["ali@example.com"],
      branchId: branch1.id, roomId: "room-c", startAt: at(-1, 16), endAt: at(-1, 17),
      status: "CANCELLED", meetingType: "INTERNAL", cancelReason: "CLIENT_CANCELLED",
      participants: [userIds["amir@example.com"]],
    },
  ];

  for (const m of meetings) {
    const { participants, guests, ...data } = m;
    await prisma.meeting.create({
      data: { ...data, startAt: m.startAt, endAt: m.endAt },
    });
    await prisma.meetingParticipant.create({
      data: { meetingId: m.id, userId: m.organizerId, role: "ORGANIZER", responseStatus: "ACCEPTED" },
    });
    for (const p of participants) {
      await prisma.meetingParticipant.create({
        data: { meetingId: m.id, userId: p },
      });
    }
    for (const g of guests ?? []) {
      await prisma.meetingGuest.create({ data: { meetingId: m.id, ...g } });
    }
    await prisma.meetingEvent.create({
      data: { meetingId: m.id, type: "CREATED", actorId: m.organizerId, data: { seed: true } },
    });
  }

  console.log("✅ Seed complete.");
  console.log("   Login: admin@example.com / Pass1234 (also operator/manager/room/ali/amir/sara @example.com)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
