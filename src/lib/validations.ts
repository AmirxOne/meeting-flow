import { z } from "zod";

export const loginSchema = z
  .object({
    password: z.string().min(6, "رمز عبور حداقل ۶ کاراکتر است"),
    /** @deprecated use identifier — kept so existing clients/tests keep working */
    email: z.string().optional(),
    identifier: z.string().optional(),
  })
  .transform((data) => ({
    password: data.password,
    identifier: (data.identifier ?? data.email ?? "").trim(),
  }))
  .refine((data) => data.identifier.length >= 3, {
    message: "ایمیل یا شماره موبایل را وارد کنید",
    path: ["identifier"],
  });
export type LoginInput = z.infer<typeof loginSchema>;

export const meetingCreateSchema = z.object({
  title: z.string().trim().min(2, "عنوان حداقل ۲ کاراکتر است").max(120),
  description: z.string().trim().max(2000).optional(),
  branchId: z.string().min(1, "شعبه را انتخاب کنید"),
  roomId: z.string().min(1).optional().nullable(),
  startAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
  endAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
  meetingType: z.enum([
    "INTERNAL", "EXTERNAL", "ONE_ON_ONE", "GROUP", "INTERVIEW", "CLIENT", "QUICK",
    "SOLO", "ONLINE",
  ]).default("INTERNAL"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  isPrivate: z.boolean().default(false),
  participantIds: z.array(z.string()).default([]),
  guests: z
    .array(
      z.object({
        name: z.string().trim().min(2, "نام مهمان الزامی است"),
        company: z.string().trim().max(100).optional(),
        phone: z.string().trim().max(20).optional(),
        email: z.string().email("ایمیل نامعتبر").optional().or(z.literal("")),
        notes: z.string().trim().max(500).optional(),
      }),
    )
    .default([]),
});
export type MeetingCreateInput = z.infer<typeof meetingCreateSchema>;

export const rescheduleSchema = z.object({
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  roomId: z.string().optional(),
  reason: z.string().trim().max(300).optional(),
});

export const cancelSchema = z.object({
  reason: z.enum([
    "CLIENT_CANCELLED", "MANAGER_UNAVAILABLE", "ROOM_UNAVAILABLE",
    "DUPLICATE_MEETING", "PERSONAL_REASON", "OTHER",
  ]),
  note: z.string().trim().max(500).optional(),
});

export const extendSchema = z.object({
  minutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
});

export const approveSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(3, "دلیل رد الزامی است").max(500),
});

export const participantAddSchema = z.object({
  userId: z.string().min(1, "کاربر را انتخاب کنید"),
  required: z.boolean().default(true),
});

export const participantRespondSchema = z.object({
  responseStatus: z.enum(["ACCEPTED", "DECLINED", "TENTATIVE"]),
  userId: z.string().optional(),
});

export const guestAddSchema = z.object({
  name: z.string().trim().min(2),
  company: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional(),
});

export const guestCheckinSchema = z.object({
  code: z.string().trim().min(4).optional(),
  meetingCode: z.string().trim().min(1).optional(),
});

export const slotsSchema = z.object({
  branchId: z.string().min(1),
  participantIds: z.array(z.string()).default([]),
  durationMin: z.union([
    z.literal(15), z.literal(30), z.literal(45), z.literal(60),
    z.number().int().min(15).max(480),
  ]),
  from: z.string().optional(),
  to: z.string().optional(),
  minCapacity: z.number().int().min(1).max(200).optional(),
  requiredEquipment: z.array(z.string()).default([]),
});

export const roomCreateSchema = z.object({
  branchId: z.string().min(1, "شعبه الزامی است"),
  floorId: z.string().optional().nullable(),
  name: z.string().trim().min(2, "نام اتاق الزامی است"),
  capacity: z.number().int().min(1, "ظرفیت حداقل ۱").max(500),
  description: z.string().trim().max(500).optional(),
  isVip: z.boolean().default(false),
  equipment: z.array(z.enum([
    "PROJECTOR", "TV", "WHITEBOARD", "VIDEO_CONFERENCE", "AUDIO_SYSTEM", "MICROPHONE",
  ])).default([]),
  minDurationMin: z.number().int().min(5).max(480).default(15),
  maxDurationMin: z.number().int().min(15).max(1440).default(480),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, "قالب HH:MM").optional().or(z.literal("")),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, "قالب HH:MM").optional().or(z.literal("")),
  managerId: z.string().optional().nullable(),
});

export const branchCreateSchema = z.object({
  name: z.string().trim().min(2, "نام شعبه الزامی است"),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(20).optional(),
  managerId: z.string().optional().nullable(),
});

export const floorCreateSchema = z.object({
  name: z.string().trim().min(1, "نام طبقه الزامی است").max(80),
  number: z.number().int("شماره طبقه باید عدد باشد").min(-5, "شماره طبقه نامعتبر است").max(200),
});

export const floorUpdateSchema = floorCreateSchema.partial();

const roomExclusionBaseSchema = z.object({
  reason: z.string().trim().min(2, "دلیل الزامی است").max(200),
  startAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
  endAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
});

export const roomExclusionCreateSchema = roomExclusionBaseSchema.refine(
  (v) => new Date(v.endAt).getTime() > new Date(v.startAt).getTime(),
  { message: "پایان باید بعد از شروع باشد", path: ["endAt"] },
);

export const roomExclusionUpdateSchema = roomExclusionBaseSchema.partial().refine(
  (v) => {
    if (!v.startAt || !v.endAt) return true;
    return new Date(v.endAt).getTime() > new Date(v.startAt).getTime();
  },
  { message: "پایان باید بعد از شروع باشد", path: ["endAt"] },
);

export const userCreateSchema = z.object({
  email: z.string().email("ایمیل نامعتبر"),
  fullName: z.string().trim().min(2, "نام الزامی است"),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  password: z.string().min(6, "رمز حداقل ۶ کاراکتر"),
  jobTitle: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  branchId: z.string().optional().nullable(),
  roleKeys: z.array(z.string()).min(1, "حداقل یک نقش انتخاب کنید"),
});

export const userUpdateSchema = z.object({
  fullName: z.string().trim().min(2).optional(),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
  branchId: z.string().nullable().optional(),
  roleKeys: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const userResetPasswordSchema = z.object({
  password: z.string().min(6, "رمز حداقل ۶ کاراکتر"),
});

export const profileSelfUpdateSchema = z.object({
  fullName: z.string().trim().min(2, "نام حداقل ۲ کاراکتر").optional(),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(100).optional(),
  department: z.string().trim().max(100).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "رمز فعلی الزامی است"),
  newPassword: z.string().min(6, "رمز جدید حداقل ۶ کاراکتر است"),
});

export const organizationUpdateSchema = z.object({
  name: z.string().trim().min(2, "نام سازمان حداقل ۲ کاراکتر").max(100).optional(),
  legalName: z.string().trim().max(200).optional().or(z.literal("")),
  timezone: z.string().trim().min(1).max(64).optional(),
  logoUrl: z.string().url("آدرس لوگو نامعتبر است").optional().or(z.literal("")),
});
export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>;

export const roleCreateSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]{1,48}$/, "کلید نقش باید حروف بزرگ لاتین و underscore باشد"),
  name: z.string().trim().min(2, "نام نقش الزامی است").max(80),
  description: z.string().trim().max(300).optional(),
  permissionKeys: z.array(z.string()).min(1, "حداقل یک دسترسی انتخاب کنید"),
});

export const roleUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(300).optional().nullable(),
  permissionKeys: z.array(z.string()).min(1).optional(),
});
