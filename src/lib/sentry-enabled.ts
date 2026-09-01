/** Shared Sentry on/off + DSN helpers (Next client/server + worker). */

type Env = NodeJS.ProcessEnv | Record<string, string | undefined>;

function truthy(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

function falsyFlag(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "0" || s === "false" || s === "no" || s === "off";
}

export function sentryDsn(env: Env = process.env): string | undefined {
  const dsn = env.SENTRY_DSN?.trim() || env.NEXT_PUBLIC_SENTRY_DSN?.trim() || "";
  return dsn || undefined;
}

export function sentryEnvironment(env: Env = process.env): string {
  return env.SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV || "development";
}

export function sentryTracesSampleRate(env: Env = process.env): number {
  const raw = env.SENTRY_TRACES_SAMPLE_RATE;
  if (raw == null || raw.trim() === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/**
 * Off when no DSN.
 * Explicit `SENTRY_ENABLED=0` wins.
 * Production + DSN → on.
 * Development / test / unset NODE_ENV (e.g. `pnpm worker:dev`) → off unless
 * `SENTRY_ENABLE_DEV=1` or `SENTRY_ENABLED=1`.
 */
export function isSentryEnabled(env: Env = process.env): boolean {
  if (!sentryDsn(env)) return false;

  const flag = env.SENTRY_ENABLED ?? env.NEXT_PUBLIC_SENTRY_ENABLED;
  if (falsyFlag(flag)) return false;
  if (truthy(flag)) return true;

  if (env.NODE_ENV === "production") return true;

  const devFlag = env.SENTRY_ENABLE_DEV ?? env.NEXT_PUBLIC_SENTRY_ENABLE_DEV;
  return truthy(devFlag);
}

export function sentryInitOptions(env: Env = process.env) {
  return {
    dsn: sentryDsn(env),
    enabled: isSentryEnabled(env),
    environment: sentryEnvironment(env),
    tracesSampleRate: sentryTracesSampleRate(env),
    sendDefaultPii: false as const,
  };
}
