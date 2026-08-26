import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("ایمیل نامعتبر است"),
  password: z.string().min(6, "رمز عبور حداقل ۶ کاراکتر است"),
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

export const guestAddSchema = z.object({
  name: z.string().trim().min(2),
  company: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional(),
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
});

export const branchCreateSchema = z.object({
  name: z.string().trim().min(2, "نام شعبه الزامی است"),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(20).optional(),
  managerId: z.string().optional().nullable(),
});

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
