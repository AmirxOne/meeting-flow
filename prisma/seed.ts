/* Seed: organization, branches, rooms, users (all roles), sample meetings. */
import { randomBytes } from "node:crypto";
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

const USER_ADMIN = ["user:create", "user:update", "user:disable", "user:reset-password"];
const ROLES: { key: string; name: string; description: string; perms: string[] }[] = [
  { key: "SUPER_ADMIN", name: "مدیر پلتفرم", description: "مدیر پلتفرم — همه سازمان‌ها (با انتخاب سازمان)", perms: [...PERM.MEETING, ...PERM.ROOM, ...PERM.BRANCH, ...PERM.USER, ...PERM.REPORT, ...PERM.SETTINGS] },
  { key: "ADMIN", name: "مدیر سازمان", description: "مدیریت کامل سازمان به جز نقش‌های سیستم", perms: [...PERM.MEETING, ...PERM.ROOM, ...PERM.BRANCH, ...USER_ADMIN, ...PERM.REPORT, ...PERM.SETTINGS] },
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
    update: { name: "شرکت نمونه", slug: "sample" },
    create: { id: "org-main", slug: "sample", name: "شرکت نمونه", legalName: "شرکت نمونه سهامی خاص", timezone: "Asia/Tehran" },
  });

  const orgBeta = await prisma.organization.upsert({
    where: { id: "org-beta" },
    update: { name: "شرکت بتا", slug: "beta" },
    create: { id: "org-beta", slug: "beta", name: "شرکت بتا", legalName: "شرکت بتا", timezone: "Asia/Tehran" },
  });

  const branch1 = await prisma.branch.upsert({
    where: { id: "branch-niavaran" },
    update: {
      wayfindingText: "از لابی اصلی به آسانسور بروید؛ طبقه اول سمت راست، اتاق جلسه آریا کنار راهرو.",
    },
    create: {
      orgId: org.id,
      id: "branch-niavaran",
      name: "شعبه نیاوران",
      address: "تهران، نیاوران، خیابان باهنر",
      phone: "021-22223344",
      wayfindingText: "از لابی اصلی به آسانسور بروید؛ طبقه اول سمت راست، اتاق جلسه آریا کنار راهرو.",
    },
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
        id: r.id, orgId: org.id, branchId: r.branchId, floorId: r.floorId, name: r.name,
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
    { email: "admin@example.com", phone: "09120001001", fullName: "علیرضا محمدی", jobTitle: "مدیر سیستم", roleKeys: ["ADMIN"], branchId: branch1.id, orgId: org.id, isSuperAdmin: false },
    { email: "superadmin@example.com", phone: "09120001002", fullName: "مدیر پلتفرم", jobTitle: "مدیر پلتفرم", roleKeys: ["SUPER_ADMIN"], branchId: null as string | null, orgId: null as string | null, isSuperAdmin: true },
    { email: "operator@example.com", phone: "09120001003", fullName: "مریم احمدی", jobTitle: "اپراتور جلسات", roleKeys: ["MEETING_OPERATOR"], branchId: branch1.id, orgId: org.id, isSuperAdmin: false },
    { email: "manager@example.com", phone: "09120001004", fullName: "حسین کریمی", jobTitle: "مدیر شعبه ونک", roleKeys: ["BRANCH_MANAGER"], branchId: branch2.id, orgId: org.id, isSuperAdmin: false },
    { email: "room@example.com", phone: "09120001005", fullName: "سارا موسوی", jobTitle: "مسئول اتاق‌ها", roleKeys: ["ROOM_MANAGER"], branchId: branch1.id, orgId: org.id, isSuperAdmin: false },
    { email: "ali@example.com", phone: "09120001006", fullName: "علی رضایی", jobTitle: "کارشناس فروش", department: "فروش", roleKeys: ["EMPLOYEE"], branchId: branch1.id, orgId: org.id, isSuperAdmin: false },
    { email: "amir@example.com", phone: "09120001007", fullName: "امیر حسینی", jobTitle: "کارشناس بازاریابی", department: "بازاریابی", roleKeys: ["EMPLOYEE"], branchId: branch1.id, orgId: org.id, isSuperAdmin: false },
    { email: "sara@example.com", phone: "09120001008", fullName: "سارا نجفی", jobTitle: "مدیر منابع انسانی", department: "منابع انسانی", roleKeys: ["EMPLOYEE", "BRANCH_MANAGER"], branchId: branch1.id, orgId: org.id, isSuperAdmin: false },
  ];
  const userIds: Record<string, string> = {};
  for (const u of users) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        fullName: u.fullName,
        jobTitle: u.jobTitle,
        branchId: u.branchId,
        phone: u.phone,
        orgId: u.orgId,
        isSuperAdmin: u.isSuperAdmin,
      },
      create: {
        email: u.email, fullName: u.fullName, passwordHash: password,
        phone: u.phone, jobTitle: u.jobTitle, department: u.department ?? null, branchId: u.branchId,
        orgId: u.orgId, isSuperAdmin: u.isSuperAdmin,
      },
    });
    userIds[u.email] = user.id;
    const roles = await prisma.role.findMany({ where: { key: { in: u.roleKeys } } });
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.createMany({
      data: roles.map((r) => ({ userId: user.id, roleId: r.id })),
    });
  }

  await prisma.meetingRoom.update({
    where: { id: "room-a" },
    data: { managerId: userIds["room@example.com"] },
  });

  // people directory — internal members mirrored from users + known externals
  await prisma.personDirectory.deleteMany({});
  const allUsers = await prisma.user.findMany({
    where: { orgId: { not: null } },
    select: { id: true, fullName: true, email: true, phone: true, jobTitle: true, orgId: true },
  });
  for (const u of allUsers) {
    if (!u.orgId) continue;
    await prisma.personDirectory.create({
      data: {
        orgId: u.orgId,
        name: u.fullName,
        kind: "INTERNAL",
        email: u.email,
        phone: u.phone,
        jobTitle: u.jobTitle,
        userId: u.id,
      },
    }).catch(() => {});
  }
  const externals = [
    { name: "مهندس تهرانی", company: "صنایع نمونه", phone: "09131234567", email: "tehrani@sanaye-nemooneh.ir", jobTitle: "مدیر پروژه" },
    { name: "مهدی کاظمی", company: "شرکت دیگر", phone: "09121234567", jobTitle: "کاندیدای استخدام" },
    { name: "خانم رضوانی", company: "گروه بازرگانی آرمان", phone: "09191234567", email: "rezvani@arman-co.ir", jobTitle: "مدیر بازرگانی" },
    { name: "آقای شریفی", company: "مشاوران مالی سپهر", phone: "09351234567", jobTitle: "مشاور مالی" },
  ];
  for (const ext of externals) {
    await prisma.personDirectory.create({ data: { ...ext, kind: "EXTERNAL", orgId: org.id } }).catch(() => {});
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
    { key: "holidayBooking", value: "BLOCK", description: "رزرو در تعطیل سازمانی: ممنوع یا نیاز به تأیید" },
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
      data: { ...data, orgId: org.id, startAt: m.startAt, endAt: m.endAt },
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
      const checkinCode = randomBytes(4).toString("hex").toUpperCase();
      await prisma.meetingGuest.create({ data: { meetingId: m.id, ...g, checkinCode } });
    }
    await prisma.meetingEvent.create({
      data: { meetingId: m.id, type: "CREATED", actorId: m.organizerId, data: { seed: true } },
    });
  }

  // second tenant — isolation fixture (org A must not see this)
  const branchBeta = await prisma.branch.upsert({
    where: { id: "branch-beta" },
    update: { orgId: orgBeta.id, name: "شعبه بتا" },
    create: {
      id: "branch-beta",
      orgId: orgBeta.id,
      name: "شعبه بتا",
      address: "تهران، سازمان بتا",
    },
  });
  const floorBeta = await prisma.floor.upsert({
    where: { branchId_number: { branchId: branchBeta.id, number: 1 } },
    update: {},
    create: { branchId: branchBeta.id, name: "طبقه اول", number: 1 },
  });
  await prisma.meetingRoom.upsert({
    where: { id: "room-beta" },
    update: { orgId: orgBeta.id, name: "اتاق بتا" },
    create: {
      id: "room-beta",
      orgId: orgBeta.id,
      branchId: branchBeta.id,
      floorId: floorBeta.id,
      name: "اتاق بتا",
      capacity: 8,
      openTime: "08:00",
      closeTime: "20:00",
    },
  });
  const betaUser = await prisma.user.upsert({
    where: { email: "beta@example.com" },
    update: {
      fullName: "کاربر سازمان بتا",
      orgId: orgBeta.id,
      branchId: branchBeta.id,
      isSuperAdmin: false,
      phone: "09120001999",
    },
    create: {
      email: "beta@example.com",
      fullName: "کاربر سازمان بتا",
      passwordHash: password,
      phone: "09120001999",
      jobTitle: "کارشناس",
      orgId: orgBeta.id,
      branchId: branchBeta.id,
      isSuperAdmin: false,
    },
  });
  userIds["beta@example.com"] = betaUser.id;
  const employeeRole = await prisma.role.findUnique({ where: { key: "EMPLOYEE" } });
  if (employeeRole) {
    await prisma.userRole.deleteMany({ where: { userId: betaUser.id } });
    await prisma.userRole.create({ data: { userId: betaUser.id, roleId: employeeRole.id } });
  }
  await prisma.personDirectory.upsert({
    where: { userId: betaUser.id },
    update: { name: betaUser.fullName, orgId: orgBeta.id, kind: "INTERNAL" },
    create: {
      orgId: orgBeta.id,
      name: betaUser.fullName,
      kind: "INTERNAL",
      email: betaUser.email,
      phone: betaUser.phone,
      jobTitle: betaUser.jobTitle,
      userId: betaUser.id,
    },
  }).catch(() => {});
  for (const p of policies) {
    await prisma.meetingPolicy.upsert({
      where: { orgId_key: { orgId: orgBeta.id, key: p.key } },
      update: { value: p.value, description: p.description },
      create: { orgId: orgBeta.id, key: p.key, value: p.value as object, description: p.description, updatedBy: betaUser.id },
    });
  }
  await prisma.meeting.deleteMany({ where: { id: "seed-meeting-beta" } });
  await prisma.meeting.create({
    data: {
      id: "seed-meeting-beta",
      orgId: orgBeta.id,
      title: "جلسه سازمان بتا — ایزوله",
      organizerId: betaUser.id,
      branchId: branchBeta.id,
      roomId: "room-beta",
      startAt: at(0, 11),
      endAt: at(0, 12),
      status: "CONFIRMED",
      meetingType: "INTERNAL",
    },
  });
  await prisma.meetingParticipant.create({
    data: { meetingId: "seed-meeting-beta", userId: betaUser.id, role: "ORGANIZER", responseStatus: "ACCEPTED" },
  });

  console.log("✅ Seed complete.");
  console.log("   Login: admin@example.com / Pass1234 (also operator/manager/room/ali/amir/sara @example.com)");
  console.log("   Isolation: beta@example.com / Pass1234  (org slug=beta)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
