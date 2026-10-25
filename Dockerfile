# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
# در deps فقط نصب پکیج‌ها — postinstall (verify assets + iconsax→src/lib) در build stage
# بعد از COPY . . اجرا می‌شود که همه‌ی ورودی‌ها موجودند
RUN pnpm install --frozen-lockfile --ignore-scripts || pnpm install --ignore-scripts

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# dummy DATABASE_URL for prisma generate (build does not touch the DB)
ENV DATABASE_URL=postgresql://build:***@localhost:5432/build
# متغیرهای الزامی برای ولیدیشن env هنگام static-analysis روت‌ها در build —
# در runtime از .env واقعی خوانده می‌شوند و این مقادیر هیچ اثری ندارند
ENV SESSION_SECRET=build-time-placeholder-secret
# postinstall اینجا اجرا می‌شود: verify فونت/لوگو + تولید src/lib/iconsax-glyphs.ts
RUN pnpm run assets:sync && pnpm exec prisma generate && pnpm build

# ---------- runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3100
RUN corepack enable && apk add --no-cache wget

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/docker ./docker
COPY --from=build /app/node_modules/.pnpm/@prisma+client*/node_modules/.prisma ./node_modules/.prisma

RUN chmod +x /app/docker/entrypoint-app.sh /app/docker/entrypoint-worker.sh

CMD ["/app/docker/entrypoint-app.sh"]
