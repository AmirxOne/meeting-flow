# Release & Rollback — مهرسا (MeetingHub)

## نسخه‌بندی (Semantic Versioning)

- **منبع واحد نسخه:** `package.json` → `version`. هیچ فایل دیگری عدد نسخه را نگه نمی‌دارد.
- برای هر انتشار: Git Tag `vX.Y.Z` روی کامیت مربوطه.
- Release Notes در GitHub Releases (بخش توضیحات tag).

### افزایش نسخه
- `PATCH` (v1.0.1): فیکس باگ سازگار
- `MINOR` (v1.1.0): قابلیت جدید سازگار
- `MAJOR` (v2.0.0): تغییر ناسازگار (مثلاً تغییر قرارداد API یا نیازمند migrate reset)

---

## چک‌لیست انتشار (هر نسخه)

1. `git status` تمیز، همه‌ی کامیت‌ها push شده
2. `pnpm typecheck && pnpm test:unit && pnpm test:integration`
3. `pnpm build` سبز
4. **Backup دیتابیس:** `COMPOSE_FILE=docker-compose.prod.yml bash scripts/backup`
5. بررسی migrationهای جدید: `pnpm exec prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <shadow>` → باید خالی باشد
6. نسخه‌ی جدید در `package.json` (فقط همین‌جا) + کامیت
7. Tag: `git tag -a vX.Y.Z -m "..."` + push tag
8. روی سرور: `git fetch && git checkout vX.Y.Z && docker compose -f docker-compose.prod.yml up -d --build`
   - entrypoint خودش `migrate deploy` می‌زند (`RUN_MIGRATIONS=true`)
9. Smoke test: `pnpm test:e2e` از یک ماشین dev با `E2E_BASE_URL=https://<سرور>` (نه روی خود سرور production)
10. پایش: `/api/health` و `/api/health/worker` + لاگ: `docker compose -f docker-compose.prod.yml logs -f app worker`

## چک‌لیست ویژه‌ی اولین استقرار

1. سرور Ubuntu + Docker + DNS (A record) به IP
2. `cp .env.production.example .env` و مقداردهی: `POSTGRES_PASSWORD`, `AUTH_SECRET` (تولید: `openssl rand -base64 48`), `APP_PORT`, تنظیمات SMTP/LDAP
3. `docker compose -f docker-compose.prod.yml up -d --build` → DB خالی + migrate deploy خودکار
4. **Seed تمیز:** `docker compose -f docker-compose.prod.yml exec app pnpm exec tsx prisma/seed.ts` با متغیرها:
   - `SEED_MODE=prod` (فقط permissions + roles + superadmin اولیه — **هیچ داده‌ی تستی وارد نمی‌شود**)
   - `PROD_ADMIN_EMAIL=...` و `PROD_ADMIN_PASSWORD=...` (یکبار مصرف — بعد از ورود عوض شود)
   - یا از داخل سرور: `SEED_MODE=prod PROD_ADMIN_EMAIL=x@y.z PROD_ADMIN_PASSWORD='...' docker compose ... run --rm app pnpm exec tsx prisma/seed.ts`
5. TLS: Caddy (نمونه: `deploy/Caddyfile.example`) یا nginx (`deploy/nginx.conf.example`) جلوی 127.0.0.1:3100
6. اولین backup پایه: `bash scripts/backup`
7. ساخت سازمان/شعبه/اتاق‌های واقعی از UI (با حساب superadmin)
8. تست login یک کاربر واقعی + یک جلسه‌ی آزمایشی → پاک کردن آن جلسه
9. Tag اولین نسخه

---

## Rollback

### اپ (بدون تغییر DB)
اگر نسخه‌ی جدید فقط کد است و migration نداشته:

```bash
# روی سرور
git fetch && git checkout v<قبلی>
docker compose -f docker-compose.prod.yml up -d --build
```

### اپ + دیتابیس (migration اجرا شده بود)
Prisma migrationها افزایشی‌اند و rollback خودکار ندارند. مسیر امن:

1. اپ را به tag قبلی برگردان (بالا)
2. اگر migration جدید `breaking` بود (ستون حذف/تغییر نوع): دیتابیس را از backup برگردان:

```bash
bash scripts/restore --force backups/<stamp قبلی>.sql.gz
```

> قاعده: قبل از هر انتشار با migration، backup اجباری است (چک‌لیست مرحله ۴). بدون backup، rollback DB ممکن نیست.

### محدودیت‌های شناخته‌شده
- Restore کامل = از دست رفتن داده‌ی بین backup تا الان → backupهای منظم (cron پیشنهادی: روزانه)
- Worker و app باید همیشه هم‌نسخه باشند (یک image، دو entrypoint) — rollback هر دو با هم

## Restore (آزمایش‌شده)

```bash
# تست در DB جداگانه (توصیه: ماهی یکبار):
bash scripts/restore --db meetinghub_restore_test --create-db backups/<f>.sql.gz
# بازگردانی واقعی:
bash scripts/restore --force backups/<f>.sql.gz
```
آزمایش‌شده در 1405-08-03: 70 کاربر + 1842 جلسه بدون خطا restore شد.
