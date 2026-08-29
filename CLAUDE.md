# مهرسا (MeetingHub) — راهنمای توسعه

## قانون طلایی: بعد از هر فیچر، تست

بعد از **هر** فیچر یا فیکس (قبل از کامیت):

1. **typecheck** — `pnpm run typecheck` باید صفر خطا باشد
2. **تست‌های موجود** — `pnpm run test` نباید هیچ‌کدام fail شوند (الان: ۴۷)
3. **تست جدید برای خود فیچر** — unit (vitest) برای منطق، یا E2E در `scripts/e2e-*.cjs` برای رفتار UI
4. **تست با رول‌های مختلف** — فیچر را با حداقل این کاربرها امتحان کن:
   - `admin@example.com` (ADMIN)
   - `ali@example.com` (EMPLOYEE)
   - `sara@example.com` (BRANCH_MANAGER — برای چک RBAC)
   - اگر فیچر محرمانگی/دسترسی دارد: `superadmin@example.com` (SUPER_ADMIN)
   - پسورد همه: مقدار `prisma/seed.ts`
5. **نهایی: E2E سبز + کامیت + push** — هر کامیت باید push شود (remote: origin = github.com/AmirxOne/meeting-flow)

### نکته‌های تست E2E

- Chrome سیستمی: `executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"`
- لاگین پایدار: POST به `/api/auth/login` و برداشتن set-cookie — نه فرم UI (گاهی در viewport بزرگ گیر می‌کند)
- seed تستی قطعی = SQL مستقیم با `docker compose exec -T postgres psql` — نه API (نیم‌فصله/ZWNJ باعث flaky می‌شود)
- rate-limit لاگین (۱۰/۱۵ دقیقه) با restart سرور پاک می‌شود
- بعد از `prisma generate` حتماً dev server ری‌استارت شود
- تست‌ها داده‌ی قبلی را خراب نکنند — بعد از خودشان cleanup کنند

## قوانین پروژه

- UI کاملاً فارسی RTL · فونت Vazirmatn · **همه‌ی اعداد نمایشی فارسی** (`faNum` / `formatJalali`)
- **Native `<select>` ممنوع** — همیشه Select کاستوم (`src/components/ui/select.tsx`)
- تقویم شمسی فقط با ICU رسمی Node (`src/lib/jalali.ts`) — نه الگوریتم دستی
- فرم‌های افزودن/ویرایش در Modal/BottomSheet (`src/components/ui/modal.tsx`) نه inline
- انیمیشن‌ها با framer-motion (`src/components/ui/motion.tsx`) — نرم، بدون bounce
- راهنمای صفحات (tours) با nextstepjs — هر صفحه‌ی جدید تور خودش را در `src/components/guided-tours.tsx` بگیرد
- جلسات محرمانه: ماسک در سطح API (`src/server/services/privacy.ts`) — فقط برگزارکننده/دعوت‌شده/SUPER_ADMIN عنوان را می‌بینند

## اجرا

```bash
docker compose up -d postgres redis
pnpm install
cp .env.example .env   # مقادیر را پر کن
pnpm exec prisma migrate dev && pnpm db:seed
pnpm dev               # → http://localhost:3100
```

## معماری

```
src/
├── app/                    # Next.js App Router
│   ├── (app)/              # صفحات احراز‌هویت‌شده (RTL shell + tours)
│   ├── api/                # ~25 route (meetings, calendar, people, …)
│   ├── login/ · page.tsx   # لاگین + لندینگ
│   └── not-found.tsx       # ۴۰۴
├── components/
│   ├── ui/                 # select, modal, toast, date-picker, people-picker, filter-bar, motion
│   ├── layout/app-shell.tsx
│   └── guided-tours.tsx    # راهنمای حفره‌دار (nextstepjs)
├── server/                 # services, auth (RBAC ۶ نقش), http helpers
├── lib/                    # jalali (ICU), api client, stores
└── prisma/                 # schema (۲۲ مدل), migrations, seed
```

## تست‌ها

- `pnpm run test` — vitest (unit + integration)
- `pnpm run typecheck`
- E2E: `node scripts/e2e-*.cjs` — smoke(14), calendar(12), people-pagination(11), people-page(6), notification-click(7), private-meetings(7), modal-forms(11), guided-tours(6), datepicker-people
