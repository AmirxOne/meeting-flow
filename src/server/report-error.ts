import { isSentryEnabled } from "@/lib/sentry-enabled";

export type ReportErrorContext = {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
};

/**
 * Capture an unexpected error. No-op when Sentry is off (no DSN / dev default)
 * so tests and local runs never load the SDK.
 */
export function reportError(error: unknown, context?: ReportErrorContext): void {
  if (!isSentryEnabled()) return;
  void import("@sentry/node")
    .then((Sentry) => {
      Sentry.captureException(error, {
        tags: context?.tags,
        extra: context?.extra,
      });
    })
    .catch(() => {
      /* SDK missing — keep the original console.error path */
    });
}
