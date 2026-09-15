import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled, sentryInitOptions } from "@/lib/sentry-enabled";

// Only init when actually configured (DSN present). A no-DSN init still
// installs web-vitals metric observers (CLS/INP with reportAllChanges),
// which crash on some layout-shift entries and spam the console:
//   Uncaught TypeError: Cannot read properties of undefined (reading 'startTime')
const enabled = isSentryEnabled();
if (enabled) Sentry.init(sentryInitOptions());

export const onRouterTransitionStart = enabled
  ? Sentry.captureRouterTransitionStart
  : undefined;
