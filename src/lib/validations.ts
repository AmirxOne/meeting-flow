import { z } from "zod";
import { validateVideoLink, VIDEO_PROVIDERS } from "@/lib/video-link";

export const loginSchema = z
  .object({
    password: z.string().min(6, "رمز عبور حداقل ۶ کاراکتر است"),
    /** @deprecated use identifier — kept so existing clients/tests keep working */
    email: z.string().optional(),
    identifier: z.string().optional(),
    orgSlug: z.string().max(48).optional(),
  })
  .transform((data) => ({
    password: data.password,
    identifier: (data.identifier ?? data.email ?? "").trim(),
    ...(data.orgSlug?.trim()
      ? { orgSlug: data.orgSlug.trim().toLowerCase() }
      : {}),
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
  recurrence: z
    .object({
      freq: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
      interval: z.coerce.number().int().min(1).max(12).default(1),
      byWeekday: z.array(z.coerce.number().int().min(0).max(6)).max(7).optional(),
      until: z.string().datetime({ offset: true }).or(z.string().min(10)).optional(),
      count: z.coerce.number().int().min(1).max(52).optional(),
    })
    .optional(),
  videoProvider: z.enum(VIDEO_PROVIDERS).nullable().optional(),
  videoUrl: z
    .string()
    .max(500)
    .nullable()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  /** Book as this user when the actor is their appointed delegate. Defaults to actor. */
  organizerId: z.string().min(1).optional(),
  /** Join waitlist instead of 409 when the room is taken. Does not lock the room. */
  waitlistIfBusy: z.boolean().optional(),
})
  .superRefine((data, ctx) => {
    const result = validateVideoLink(data.videoProvider ?? null, data.videoUrl ?? null);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", path: ["videoUrl"], message: result.message });
    }
    if (data.waitlistIfBusy && data.recurrence) {
      ctx.addIssue({
        code: "custom",
        path: ["waitlistIfBusy"],
        message: "لیست انتظار برای جلسه تکراری پشتیبانی نمی‌شود",
      });
    }
  });
export type MeetingCreateInput = z.infer<typeof meetingCreateSchema>;

export const videoLinkSchema = z
  .object({
    videoProvider: z.enum(VIDEO_PROVIDERS).nullable().optional(),
    videoUrl: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .transform((v) => (v && v.trim() ? v.trim() : null)),
  })
  .superRefine((data, ctx) => {
    const result = validateVideoLink(data.videoProvider ?? null, data.videoUrl ?? null);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", path: ["videoUrl"], message: result.message });
    }
  });
export type VideoLinkInput = z.infer<typeof videoLinkSchema>;

export const seriesScopeSchema = z.enum(["THIS", "FOLLOWING", "ALL"]).default("THIS");

export const rescheduleSchema = z.object({
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  roomId: z.string().optional(),
  reason: z.string().trim().max(300).optional(),
  scope: seriesScopeSchema.optional(),
});

export const cancelSchema = z.object({
  reason: z.enum([
    "CLIENT_CANCELLED", "MANAGER_UNAVAILABLE", "ROOM_UNAVAILABLE",
    "DUPLICATE_MEETING", "PERSONAL_REASON", "OTHER",
  ]),
  note: z.string().trim().max(500).optional(),
  scope: seriesScopeSchema.optional(),
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
  organizerId: z.string().min(1).optional(),
});

export const delegateCreateSchema = z.object({
  userId: z.string().min(1, "کاربر را انتخاب کنید"),
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
  wayfindingText: z.string().trim().max(500).optional().nullable(),
});

export const floorCreateSchema = z.object({
  name: z.string().trim().min(1, "نام طبقه الزامی است").max(80),
  number: z.number().int("شماره طبقه باید عدد باشد").min(-5, "شماره طبقه نامعتبر است").max(200),
  wayfindingText: z.string().trim().max(500).optional().nullable(),
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

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url("آدرس اشتراک نامعتبر است"),
  keys: z.object({
    p256dh: z.string().min(8, "کلید p256dh نامعتبر است"),
    auth: z.string().min(4, "کلید auth نامعتبر است"),
  }),
  expirationTime: z.number().nullable().optional(),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url().optional(),
});

const notifChannelFlagsSchema = z
  .object({
    IN_APP: z.boolean().optional(),
    SMS: z.boolean().optional(),
    EMAIL: z.boolean().optional(),
    PUSH: z.boolean().optional(),
  })
  .strict();

export const notificationPrefsPatchSchema = z
  .object({
    invite: notifChannelFlagsSchema.optional(),
    reminder: notifChannelFlagsSchema.optional(),
    reschedule: notifChannelFlagsSchema.optional(),
  })
  .strict();
export type NotificationPrefsPatch = z.infer<typeof notificationPrefsPatchSchema>;

export const smsTestSchema = z.object({
  phone: z.string().trim().min(10, "شماره موبایل را وارد کنید").max(20),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(3, "ایمیل یا شماره موبایل را وارد کنید"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const completePasswordResetSchema = z
  .object({
    token: z.string().trim().optional(),
    identifier: z.string().trim().optional(),
    code: z.string().trim().optional(),
    password: z.string().min(6, "رمز جدید حداقل ۶ کاراکتر است"),
    confirmPassword: z.string().min(6, "تکرار رمز حداقل ۶ کاراکتر است"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "رمز جدید و تکرار آن یکسان نیست",
    path: ["confirmPassword"],
  })
  .refine((data) => Boolean(data.token?.trim()) || Boolean(data.code?.trim()), {
    message: "لینک یا کد یک‌بارمصرف را وارد کنید",
    path: ["token"],
  });
export type CompletePasswordResetInput = z.infer<typeof completePasswordResetSchema>;

export const totpCodeSchema = z.object({
  code: z.string().trim().min(1, "کد ۶ رقمی را وارد کنید"),
});

export const twoFactorDisableSchema = z
  .object({
    code: z.string().trim().optional(),
    recoveryCode: z.string().trim().optional(),
  })
  .refine((data) => Boolean(data.code?.trim()) || Boolean(data.recoveryCode?.trim()), {
    message: "کد authenticator یا کد بازیابی را وارد کنید",
    path: ["code"],
  });
export type TwoFactorDisableInput = z.infer<typeof twoFactorDisableSchema>;

export const twoFactorLoginSchema = z
  .object({
    challengeToken: z.string().trim().min(16, "نشست تأیید ناقص است"),
    code: z.string().trim().optional(),
    recoveryCode: z.string().trim().optional(),
  })
  .refine((data) => Boolean(data.code?.trim()) || Boolean(data.recoveryCode?.trim()), {
    message: "کد authenticator یا کد بازیابی را وارد کنید",
    path: ["code"],
  });
export type TwoFactorLoginInput = z.infer<typeof twoFactorLoginSchema>;

export const organizationUpdateSchema = z.object({
  name: z.string().trim().min(2, "نام سازمان حداقل ۲ کاراکتر").max(100).optional(),
  legalName: z.string().trim().max(200).optional().or(z.literal("")),
  timezone: z.string().trim().min(1).max(64).optional(),
  logoUrl: z.string().url("آدرس لوگو نامعتبر است").optional().or(z.literal("")),
});
export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>;

export const ssoSettingsUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  buttonLabel: z.string().trim().min(2, "متن دکمه خیلی کوتاه است").max(80).optional(),
  groupRoleMap: z
    .array(
      z.object({
        group: z.string().trim().min(1, "شناسه گروه را وارد کنید").max(200),
        roleKey: z.string().trim().min(1, "نقش را انتخاب کنید").max(64),
      }),
    )
    .max(50)
    .optional(),
});
export type SsoSettingsUpdateInput = z.infer<typeof ssoSettingsUpdateSchema>;

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

export const agendaItemInputSchema = z.object({
  title: z.string().trim().min(1, "عنوان آیتم الزامی است").max(160),
  durationMin: z.number().int().min(1).max(480).nullable().optional(),
  ownerId: z.string().min(1).nullable().optional(),
});

export const agendaReplaceSchema = z.object({
  items: z.array(agendaItemInputSchema).max(20, "حداکثر ۲۰ آیتم در دستور جلسه"),
});
export type AgendaReplaceInput = z.infer<typeof agendaReplaceSchema>;

export const minutesDecisionInputSchema = z.object({
  text: z.string().trim().min(1, "متن تصمیم الزامی است").max(400),
  ownerId: z.string().min(1).nullable().optional(),
  dueAt: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
});

export const holidayCreateSchema = z.object({
  dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ نامعتبر است"),
  name: z.string().trim().min(2, "نام تعطیلی حداقل ۲ کاراکتر است").max(80),
});
export type HolidayCreateInput = z.infer<typeof holidayCreateSchema>;

export const minutesUpsertSchema = z.object({
  body: z.string().trim().min(1, "متن صورتجلسه الزامی است").max(8000),
  decisions: z.array(minutesDecisionInputSchema).max(20, "حداکثر ۲۰ تصمیم").default([]),
});
export type MinutesUpsertInput = z.infer<typeof minutesUpsertSchema>;

export const orgSetupSchema = z.object({
  orgName: z.string().trim().min(2, "نام سازمان حداقل ۲ کاراکتر").max(120),
  orgSlug: z
    .string()
    .trim()
    .max(48)
    .optional()
    .or(z.literal("")),
  adminFullName: z.string().trim().min(2, "نام مدیر الزامی است").max(80),
  adminEmail: z.string().trim().email("ایمیل مدیر نامعتبر است"),
  adminPassword: z.string().min(6, "رمز حداقل ۶ کاراکتر"),
  branchName: z.string().trim().min(2, "نام شعبه الزامی است").max(80),
  roomName: z.string().trim().min(2, "نام اتاق الزامی است").max(80),
  roomCapacity: z.coerce.number().int().min(1, "ظرفیت حداقل ۱").max(500).default(8),
});
export type OrgSetupInput = z.infer<typeof orgSetupSchema>;
