import * as Sentry from "@sentry/node";
import { isSentryEnabled, sentryInitOptions } from "@/lib/sentry-enabled";

/** Init Node SDK for the standalone worker (`pnpm worker` / Docker ROLE=worker). */
export function initNodeSentry(service: string): void {
  if (!isSentryEnabled()) return;
  const opts = sentryInitOptions();
  if (!opts.dsn) return;
  Sentry.init({
    ...opts,
    initialScope: { tags: { service } },
  });
}

export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!isSentryEnabled()) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    /* ignore */
  }
}
