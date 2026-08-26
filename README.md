# مرسا — سامانه مدیریت جلسات سازمانی

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
pnpm dev                              # → http://localhost:3100
pnpm worker                           # در ترمینال دوم — یادآورها و lifecycle
```

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
| `pnpm test` | تست‌های unit |
| `pnpm vitest run tests/integration` | تست‌های integration (نیازمند dev server + seed) |
| `pnpm db:migrate` / `pnpm db:seed` | migration / seed |
| `pnpm worker` | پروسه پس‌زمینه یادآور/lifecycle |

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
pnpm test                            # 31 unit — state machine, conflicts, jalali
pnpm vitest run tests/integration   # 16 integration — روی dev server واقعی
```

Integration شامل: لاگین اشتباه (401)، me، ساخت جلسه (auto-confirm)، **رد رزرو تداخلی (409)**، جلسه با مهمان → PENDING → تأیید اپراتور، employee نمی‌تواند تأیید کند (403)، reschedule + event history، تغییر اتاق، افزودن مشارکت‌کننده، لغو با دلیل، آزادشدن اسلات، availability، RBAC گزارش‌ها و audit.

## Environment Variables

همه در `.env.example` با توضیح — مهم‌ترین‌ها: `DATABASE_URL`، `SESSION_SECRET`، `SESSION_TTL_HOURS`، `NOTIFICATION_SMS_PROVIDER`، `WORKER_POLL_INTERVAL_MS`.

## قابلیت‌های آماده برای آینده

- **SMS/Email واقعی**: فقط Provider جدید implement کنید (`SmsProvider` interface) — کال‌سایت‌ها تغییر نمی‌کنند.
- **Google/Outlook Calendar sync**: معماری event-based است؛ `MeetingEvent` + provider interface آماده اتصال.
- **QR Check-in مهمان‌ها**: فیلد `checkinCode` در `MeetingGuest` از روز اول هست.
