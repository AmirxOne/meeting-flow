# Meeting Flow (مهرسا)

> Corporate meeting management system — rooms, approval workflow, conflict detection, Jalali (Persian) calendar, notifications & analytics. Next.js + Prisma + PostgreSQL.

سیستم مدیریت جلسات سازمانی (Corporate Meeting Management System) — Next.js + Prisma + PostgreSQL.

## شروع سریع (Docker)

```bash
cp .env.example .env
docker compose up -d          # app + postgres + redis + worker
# اولین اجرا: migration و seed خودکار در کانتینر app
# ورود: admin@example.com / Pass1234
```

اپ روی `http://localhost:3100` بالا می‌آید.

## توسعه محلی (بدون Docker برای app)

```bash
docker compose up -d postgres redis   # فقط دیتابیس
pnpm install
pnpm exec prisma migrate dev          # migration
docker compose exec -T postgres psql -U meetinghub -d meetinghub < prisma/sql/room-exclusion.sql
pnpm db:seed                          # داده اولیه
pnpm dev                              # ترمینال ۱ → http://localhost:3100
pnpm worker:dev                       # ترمینال ۲ — **الزامی برای یادآورها** (in-app/SMS/Email)
```

> **یادآور جلسات** فقط وقتی ارسال می‌شوند که worker در حال اجرا باشد (`pnpm worker:dev` در dev، یا سرویس `worker` در docker compose). بدون worker، ردیف‌های `MeetingReminder` schedule می‌شوند ولی send نمی‌شوند.

## حساب‌های نمونه (رمز همه: `Pass1234`)

| ایمیل | نقش |
|---|---|
| `admin@example.com` | ADMIN — دسترسی کامل |
| `operator@example.com` | MEETING_OPERATOR — تأیید/رد جلسات |
| `manager@example.com` | BRANCH_MANAGER — مدیر شعبه ونک |
| `room@example.com` | ROOM_MANAGER — مدیریت اتاق‌ها |
| `ali@example.com` | EMPLOYEE — کارمند عادی |
| `amir@example.com` | EMPLOYEE |
| `sara@example.com` | EMPLOYEE + BRANCH_MANAGER |

## دستورات

| دستور | توضیح |
|---|---|
| `pnpm dev` | سرور توسعه (پورت ۳۱۰۰) |
| `pnpm build` / `pnpm start` | پروداکشن |
| `pnpm typecheck` | بررسی TypeScript |
| `pnpm test` | vitest — **242** تست (155 unit + 87 integration؛ integration نیازمند dev server `:3100` + seed) |
| `pnpm vitest run tests/integration` | فقط integration (**87** تست) |
| `pnpm db:migrate` / `pnpm db:seed` | migration / seed |
| `pnpm worker` | worker یک‌بار (production) |
| `pnpm worker:dev` | worker با hot-reload — **همراه dev لازم است** |

## قاعده‌ی تست — بعد از هر فیچر

هر فیچر/فیکس قبل از کامیت باید این چرخه را طی کند (جزئیات کامل در `CLAUDE.md`):

1. `pnpm run typecheck` → صفر خطا
2. `pnpm run test` → همه سبز (**242** تست: 155 unit + 87 integration)
3. تست جدید مخصوص همان فیچر (unit یا E2E در `scripts/`)
4. تست دستی با رول‌های مختلف: `admin` (ADMIN)، `ali` (EMPLOYEE)، `sara` (BRANCH_MANAGER) و برای فیچرهای دسترسی `superadmin` (SUPER_ADMIN) — پسوردها در seed
5. کامیت + push به origin

## معماری

```
src/
├── app/
│   ├── (app)/            # صفحات محافظت‌شده (layout با auth check)
│   │   ├── dashboard/    # داشبورد و آمار
│   │   ├── calendar/     # تقویم شمسی/میلادی — ماه/روز
│   │   ├── meetings/     # لیست، جزئیات (lifecycle کامل)، ایجاد wizard
│   │   ├── availability/ # Free Slot Finder مشترک
│   │   ├── rooms/        # وضعیت زنده اتاق‌ها + timeline
│   │   ├── branches/  users/  notifications/  reports/  admin/
│   ├── api/              # Route Handlers (Zod + RBAC)
│   └── login/
├── server/
│   ├── auth/             # session (HTTP-only cookie) + permissions
│   ├── services/         # business logic خالص
│   │   ├── meeting.service.ts      # create/transition/reschedule/extend/changeRoom
│   │   ├── conflict.service.ts     # hard/soft conflicts + interval math
│   │   ├── availability.service.ts # Free Slot Finder
│   │   ├── state-machine.ts        # گذارهای وضعیت + approval policy
│   │   ├── reminder.service.ts     # reminder scheduling + worker ticks
│   │   ├── notification.service.ts # in-app + SMS/Email provider ports
│   │   └── report.service.ts       # آمار و CSV
│   └── http.ts           # پاسخ استاندارد + audit log
├── lib/                  # jalali (ICU-based)، fa digits، validations (Zod)
└── worker/               # پروسه مستقل background
```

## نکات کلیدی پیاده‌سازی

- **ضد double-booking سه‌لایه**: بررسی تداخل در سرویس + تراکنش SERIALIZABLE با `SELECT … FOR UPDATE` روی ردیف اتاق + **EXCLUDE constraint سطح PostgreSQL** (`tsrange WITH &&`) — حتی SQL خام هم نمی‌تواند رزرو تداخلی بسازد.
- **زمان‌ها**: همه به‌صورت UTC instant ذخیره می‌شوند؛ نمایش با تبدیل به منطقه تهران. تقویم شمسی روی ICU (`en-US-u-ca-persian`) بنا شده — با تقویم رسمی ایران (کبیسه‌های astronomical مثل ۱۴۰۳) exact مطابق است.
- **RBAC**: نقش‌ها از permissionها جدا هستند؛ هر route در backend بررسی می‌کند (مخفی‌کردن دکمه امنیت نیست).
- **Approval policy** قابل تنظیم از پنل ادمین: مهمان خارجی / اتاق VIP / مدت > آستانه → تأیید اپراتور.
- **Notification**: در دیتابیس ذخیره می‌شود + پورت‌های `SmsProvider`/`EmailProvider` (dev = mock لاگ‌کننده؛ production با env وصل می‌شود).
- **Audit log**: تمام عملیات حساس با actor/old/new/IP ثبت می‌شوند.

## تست‌ها

```bash
pnpm run test        # 242 — 155 unit + 87 integration (vitest)
pnpm run typecheck   # tsc --noEmit
pnpm vitest run tests/integration   # فقط integration (87) — dev server :3100 + seed
```

**Unit (155)** — state machine، conflicts، jalali، providers، lifecycle، RBAC helpers، …

**Integration (87)** — لاگین، lifecycle جلسه، start/end/no-show، availability، floors، room exclusions، user admin، RSVP، policies، organization، guest check-in، role management (SUPER_ADMIN)، profile self-service، …

**E2E** (نیازمند dev server روی `:3100` + Chrome سیستمی؛ از `scripts/e2e-lib.cjs`):

```bash
node scripts/e2e-smoke.cjs
node scripts/e2e-calendar.cjs
node scripts/e2e-modal-forms.cjs
node scripts/e2e-people-pagination.cjs
node scripts/e2e-people-page.cjs
node scripts/e2e-notification-click.cjs
node scripts/e2e-private-meetings.cjs
node scripts/e2e-guided-tours.cjs
node scripts/e2e-datepicker-people.cjs
node scripts/e2e-room-branch-crud.cjs
node scripts/e2e-reports.cjs
node scripts/e2e-availability.cjs
node scripts/e2e-branches.cjs
node scripts/e2e-admin-policies.cjs
node scripts/e2e-audit-logs.cjs
node scripts/e2e-checkin.cjs
node scripts/e2e-missing-pages.cjs   # admin/settings, meetings/new wizard, rooms/[id], /users
node scripts/e2e-org-branding.cjs
node scripts/e2e-room-exclusions.cjs
```

## Environment Variables

همه در `.env.example` با توضیح — مهم‌ترین‌ها: `DATABASE_URL`، `SESSION_SECRET`، `SESSION_TTL_HOURS`، `REMINDER_CHANNELS`، `NOTIFICATION_SMS_PROVIDER`، `WORKER_POLL_INTERVAL_MS`.

## قابلیت‌های آماده برای آینده

- **SMS/Email واقعی**: فقط Provider جدید implement کنید (`SmsProvider` interface) — کال‌سایت‌ها تغییر نمی‌کنند. یادآورها با `REMINDER_CHANNELS=IN_APP,SMS,EMAIL` در `MeetingReminder` schedule می‌شوند و worker ارسال می‌کند.
- **Google/Outlook Calendar sync**: معماری event-based است؛ `MeetingEvent` + provider interface آماده اتصال.

## نقشه‌ی ادامه‌ی توسعه (Roadmap)

- [ ] اتصال SMS واقعی (Kavenegar) — provider ports آماده در `notification.service`
- [ ] ایمیل SMTP — همان interface
- [ ] Sync تقویم Google / Outlook — معماری CalendarProvider آماده است
- [x] QR Check-in مهمان‌ها — `/checkin/[code]` + QR canvas + self check-in + E2E (`e2e-checkin.cjs`)
- [ ] SSO / LDAP / Active Directory

## لایسنس

MIT
