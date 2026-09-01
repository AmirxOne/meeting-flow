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

## نصب در سرور مشتری (on-prem)

استقرار پیشنهادی: **Docker Compose تولید** + **TLS در nginx یا Caddy** روی همان سرور. اپ فقط روی `127.0.0.1:3100` bind می‌شود؛ اینترنت از پروکسی معکوس می‌آید.

### پیش‌نیاز

- Docker Engine + Compose v2
- دامنهٔ DNS به IP سرور (برای Let's Encrypt)
- پورت‌های 80/443 روی nginx یا Caddy

### راه‌اندازی

```bash
git clone … && cd meeting-flow
cp .env.production.example .env
# SESSION_SECRET، POSTGRES_PASSWORD، WORKER_TICK_SECRET و APP_URL را پر کنید
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps   # app + worker هر دو healthy
```

- **اولین بار (DB خالی):** مرورگر → `https://meetings.example.com/start` — ویزارد سازمان + ادمین + شعبه + اتاق (جایگزین seed دستی). از `pnpm db:seed` در تولید استفاده نکنید.
- **بازگردانی از بکاپ:** بخش [پشتیبان PostgreSQL](#پشتیبان-postgresql-docker) — با `COMPOSE_FILE=docker-compose.prod.yml`.

### worker الزامی است

یادآورهای in-app / SMS / Email فقط با **سرویس `worker`** ارسال می‌شوند. بدون worker، ردیف‌های `MeetingReminder` schedule می‌شوند ولی send نمی‌شوند.

```bash
docker compose -f docker-compose.prod.yml logs -f worker
```

وضعیت در **ادمین → تنظیمات** (heartbeat / stale) و `GET /api/health/worker` (از DB). healthcheck داخلی worker: `http://127.0.0.1:3101/health` (فقط داخل کانتینر).

**جایگزین (توصیه نمی‌شود):** cron هر ۱–۵ دقیقه → `POST /api/internal/worker-tick` با `Authorization: Bearer $WORKER_TICK_SECRET`. worker جدا همچنان ترجیح داده می‌شود.

### TLS — nginx

نمونه: [`deploy/nginx.conf.example`](deploy/nginx.conf.example) — upstream به `127.0.0.1:3100`، `client_max_body_size` برای پیوست جلسه، certbot.

### TLS — Caddy

نمونه: [`deploy/Caddyfile.example`](deploy/Caddyfile.example) — HTTPS خودکار، `reverse_proxy 127.0.0.1:3100`.

`APP_URL` در `.env` باید همان URL عمومی HTTPS باشد (لینک ایمیل، OAuth redirect، PWA).

### healthcheck و مانیتورینگ

| Endpoint | کاربرد |
|---|---|
| `GET /api/health` | liveness اپ (Docker + uptime) |
| `GET /api/health/worker` | worker زنده / stale (503 اگر tick قدیمی) |

Volumeها در `docker-compose.prod.yml`: **`pgdata`** (Postgres)، **`redisdata`**، **`attachments`** (پیوست و آواتار). برای DR کامل علاوه بر dump DB، `.env` و volume attachments را archive کنید — جزئیات در بخش پشتیبان.

### Sentry (اختیاری)

خطاهای Next و worker — [`Environment Variables`](#environment-variables) و `.env.production.example`.

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

## پشتیبان PostgreSQL (Docker)

دادهٔ Postgres در volume نام‌گذاری‌شدهٔ **`pgdata`** نگه داشته می‌شود (`docker-compose.yml` → `postgres.volumes`). این volume از ری‌استارت کانتینر جان سالم به در می‌برد؛ `docker compose down` بدون `-v` داده را نگه می‌دارد. **`docker compose down -v`** volume را حذف می‌کند — فقط وقتی عمداً DB را صفر می‌کنید.

اسکریپت‌ها فقط **محتوای دیتابیس** را می‌گیرند/برمی‌گردانند (`pg_dump` / `psql` از داخل سرویس `postgres`):

```bash
bash scripts/backup
# → backups/meetinghub-YYYYMMDD-HHMMSS.sql.gz
# compose تولید: COMPOSE_FILE=docker-compose.prod.yml bash scripts/backup

bash scripts/restore --db meetinghub_restore_test --create-db backups/meetinghub-....sql.gz
docker compose exec -T postgres psql -U meetinghub -d meetinghub_restore_test -c 'SELECT count(*) FROM "User";'
docker compose exec -T postgres psql -U meetinghub -d postgres -c 'DROP DATABASE meetinghub_restore_test;'
```

بازگردانی روی DB اصلی (`meetinghub`) فقط با `--force` مجاز است — قبلش حتماً `scripts/backup` بگیرید.

**خارج از dump:** فایل `.env`، **`SESSION_SECRET`** (بعد از restore همهٔ sessionها باطل می‌شوند مگر secret همان قبلی بماند)، **`MEETING_ATTACHMENTS_DIR`** (پیوست جلسه و آواتار روی دیسک)، Redis (rate-limit موقت)، و secretهای OAuth/TOTP/SMS. برای DR کامل علاوه بر dump، `.env` و پوشهٔ attachments را جدا archive کنید.

در Windows از Git Bash یا WSL اجرا کنید؛ یا همان دستورات `docker compose exec` را دستی در PowerShell تکرار کنید.

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
| `pnpm test` | vitest — **489** تست (369 unit + 120 integration؛ integration نیازمند dev server `:3100` + seed) |
| `pnpm vitest run tests/integration` | فقط integration (**120** تست) |
| `pnpm db:migrate` / `pnpm db:seed` | migration / seed |
| `pnpm worker` | worker یک‌بار (production) |
| `pnpm worker:dev` | worker با hot-reload — **همراه dev لازم است** |

## قاعده‌ی تست — بعد از هر فیچر

هر فیچر/فیکس قبل از کامیت باید این چرخه را طی کند (جزئیات کامل در `CLAUDE.md`):

1. `pnpm run typecheck` → صفر خطا
2. `pnpm run test` → همه سبز (**489** تست: 369 unit + 120 integration)
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
- **SSO (OIDC / Entra ID)**: `AUTH_MODE=local,sso` فرم رمز و دکمهٔ «ورود با حساب سازمانی» را همزمان نشان می‌دهد. کاربر بعد از consent در مرورگر auto-provision می‌شود (مثل LDAP). نگاشت گروه Entra → نقش مهرسا از env (`OIDC_GROUP_ROLE_MAP`) یا **تنظیمات سازمان** (`/admin/settings`). اگر ۲FA فعال باشد بعد از SSO هم کد authenticator خواسته می‌شود. LDAP bind جدا می‌ماند (`AUTH_MODE=ldap` یا `ldap,sso`).

## تست‌ها

```bash
pnpm run test        # 489 — 369 unit + 120 integration (vitest)
pnpm run typecheck   # tsc --noEmit
pnpm vitest run tests/integration   # فقط integration (120) — dev server :3100 + seed
```

**Unit (369)** — state machine، conflicts، jalali، providers، lifecycle، RBAC helpers، صورتجلسه، …

**Integration (120)** — لاگین، lifecycle جلسه، start/end/no-show، availability، floors، room exclusions، user admin، RSVP، policies، organization، guest check-in، role management (SUPER_ADMIN)، profile self-service، صورتجلسه، …

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
node scripts/e2e-minutes.cjs
```

## ورود سازمانی (SSO / Microsoft Entra ID)

LDAP فعلی bind روی سرور است. SSO ورود مرورگر با OAuth/OIDC است (حداقل Azure AD / Entra ID).

1. در Entra یک Web app ثبت کنید. Redirect URI: `{APP_URL}/api/auth/sso/callback` (مثلاً `http://localhost:3100/api/auth/sso/callback`).
2. در Token configuration ادعاهای اختیاری `groups` (و در صورت نیاز app roles) را اضافه کنید.
3. در `.env`:

```
AUTH_MODE=local,sso
OIDC_TENANT=organizations
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...
OIDC_GROUP_ROLE_MAP=group-object-id:ADMIN,HR Managers:BRANCH_MANAGER
```

4. `local,sso` یعنی فرم ایمیل/رمز **و** دکمه SSO با هم. فقط SSO: `AUTH_MODE=sso`. LDAP+SSO: `AUTH_MODE=ldap,sso`.
5. نگاشت گروه و متن دکمه از **ادمین → تنظیمات سازمان** هم قابل ویرایش است (راز کلاینت فقط در env می‌ماند).
6. کاربر جدید با نقش مپ‌شده (یا `EMPLOYEE`) ساخته می‌شود. اگر گروه مچ شود، نقش کاربر موجود هم با گروه همگام می‌شود.

جزئیات env در `.env.example`.

## پایلوت پیامک کاوه‌نگار

در توسعه پیش‌فرض **mock** است (فقط لاگ، ارسال نمی‌شود). برای پایلوت واقعی:

1. **کلید API** — در پنل کاوه‌نگار یک API Key بسازید و در `.env` بگذارید:
   ```
   NOTIFICATION_SMS_PROVIDER=kavenegar
   SMS_API_KEY=...
   ```
2. **فرستنده (`SMS_FROM`)** — شماره/کد خط خدماتی تأییدشده در پنل (مثال: `10004346`). بدون این مقدار provider ساخته نمی‌شود.
3. **قالبکد (اختیاری)** — اگر اپراتور قالب اجباری دارد، در پنل یک الگو با نام انگلیسی بسازید، مثلاً `mehrsa-reminder` با متن:
   ```
   یادآوری جلسه %token2% — %token% دقیقه دیگر
   ```
   سپس:
   ```
   SMS_TEMPLATE=mehrsa-reminder
   ```
   با قالب، APIی `verify/lookup.json` صدا زده می‌شود (`token` = دقیقه تا جلسه، `token2` = عنوان). بدون قالب، متن کامل با `sms/send.json` و همان فرستنده ارسال می‌شود.
4. **کانال یادآور** — `REMINDER_CHANNELS` باید `SMS` داشته باشد (مثلاً `IN_APP,SMS`). کاربر در پروفایل می‌تواند پیامک را خاموش کند. شماره موبایل در پروفایل الزامی است.
5. **ری‌استارت** — بعد از تغییر env هم `pnpm dev` و هم `pnpm worker:dev` را ری‌استارت کنید. بدون worker ردیف یادآور ساخته می‌شود ولی SMS نمی‌رود.
6. **تست با یک شماره** — با `admin@example.com` به **ادمین → تنظیمات سازمان** بروید، کارت «پیامک کاوه‌نگار» را ببینید، یک شماره (مثلاً موبایل خودتان) بزنید و «ارسال آزمایشی» را بزنید. نتیجه در همان کارت و در **لاگ ممیزی** (`Sms` / پیامک آزمایشی) ثبت می‌شود.
7. **خطا** — اگر کاوه‌نگار رد کند، worker ردیف را `PENDING` می‌گذارد و متن خطا در `MeetingReminder.lastError` و کارت تنظیمات (آخرین ارسال) دیده می‌شود. ارسال موفق `lastError` را پاک می‌کند.

برگشت به توسعه: `NOTIFICATION_SMS_PROVIDER=mock` (حتی اگر `SMS_API_KEY` در فایل مانده باشد ارسال واقعی نمی‌شود).

## ایمیل SMTP

در توسعه پیش‌فرض **mock** است. برای تولید:

```
NOTIFICATION_EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=no-reply@example.com
```

قالب دعوت، یادآور و صورتجلسه HTML سادهٔ RTL است (لینک جلسه از `APP_URL`). کانال `EMAIL` باید در `REMINDER_CHANNELS` باشد. خطاهای یادآور در `MeetingReminder.lastError` می‌مانند. بعد از تغییر env، `pnpm dev` و `pnpm worker:dev` را ری‌استارت کنید.

## Environment Variables

همه در `.env.example` با توضیح — مهم‌ترین‌ها: `DATABASE_URL`، `SESSION_SECRET`، `SESSION_TTL_HOURS`، `REMINDER_CHANNELS`، `NOTIFICATION_SMS_PROVIDER`، `WORKER_POLL_INTERVAL_MS`.

خطاهای کلاینت و سرور Next.js و همچنین worker جدا (`pnpm worker` / `POST /api/internal/worker-tick` / ارسال یادآور) با Sentry گزارش می‌شوند. `SENTRY_DSN` برای سرور و worker و `NEXT_PUBLIC_SENTRY_DSN` برای مرورگر را در `.env` بگذارید. در development (و وقتی `NODE_ENV` خالی است، مثل `pnpm worker:dev`) پیش‌فرض خاموش است؛ برای تست محلی `SENTRY_ENABLE_DEV=1` یا `SENTRY_ENABLED=1`. در production با DSN روشن می‌شود مگر `SENTRY_ENABLED=0`. بدون DSN اپ و worker عادی کار می‌کنند. آپلود source map اختیاری است (`SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT`).

## قابلیت‌های آماده برای آینده

- **SMS/Email واقعی**: SMS کاوه‌نگار با `SMS_API_KEY`؛ ایمیل SMTP با `SMTP_*` (هر دو در dev پیش‌فرض mock). یادآورها با `REMINDER_CHANNELS` و worker ارسال می‌شوند.
- **Google/Outlook Calendar sync**: معماری event-based است؛ `MeetingEvent` + provider interface آماده اتصال.

## نقشه‌ی ادامه‌ی توسعه (Roadmap)

- [x] اتصال SMS واقعی (Kavenegar) — `SMS_API_KEY` + پایلوت در ادمین → تنظیمات؛ mock برای dev
- [x] ایمیل SMTP — قالب RTL دعوت/یادآور/صورتجلسه؛ mock برای dev
- [ ] Sync تقویم Google / Outlook — معماری CalendarProvider آماده است
- [x] QR Check-in مهمان‌ها — `/checkin/[code]` + QR canvas + self check-in + E2E (`e2e-checkin.cjs`)
- [x] SSO / LDAP / Active Directory — LDAP bind + OIDC (Entra ID) با `AUTH_MODE=local,sso`

## لایسنس

MIT
