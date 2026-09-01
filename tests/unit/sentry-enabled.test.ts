import { describe, it, expect } from "vitest";
import {
  isSentryEnabled,
  sentryDsn,
  sentryEnvironment,
  sentryTracesSampleRate,
} from "@/lib/sentry-enabled";
import { reportError } from "@/server/report-error";

const DSN = "https://key@o0.ingest.sentry.io/1";

describe("sentryDsn", () => {
  it("is empty without env", () => {
    expect(sentryDsn({})).toBeUndefined();
    expect(sentryDsn({ SENTRY_DSN: "  " })).toBeUndefined();
  });

  it("prefers SENTRY_DSN then NEXT_PUBLIC_SENTRY_DSN", () => {
    expect(sentryDsn({ SENTRY_DSN: DSN })).toBe(DSN);
    expect(sentryDsn({ NEXT_PUBLIC_SENTRY_DSN: DSN })).toBe(DSN);
    expect(
      sentryDsn({ SENTRY_DSN: "https://a@o0.ingest.sentry.io/1", NEXT_PUBLIC_SENTRY_DSN: DSN }),
    ).toBe("https://a@o0.ingest.sentry.io/1");
  });
});

describe("isSentryEnabled", () => {
  it("is off without DSN", () => {
    expect(isSentryEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isSentryEnabled({ NODE_ENV: "production", SENTRY_ENABLED: "1" })).toBe(false);
  });

  it("is on in production when DSN is set", () => {
    expect(isSentryEnabled({ NODE_ENV: "production", SENTRY_DSN: DSN })).toBe(true);
  });

  it("honors explicit SENTRY_ENABLED=0 even in production", () => {
    expect(
      isSentryEnabled({ NODE_ENV: "production", SENTRY_DSN: DSN, SENTRY_ENABLED: "0" }),
    ).toBe(false);
    expect(
      isSentryEnabled({ NODE_ENV: "production", SENTRY_DSN: DSN, SENTRY_ENABLED: "false" }),
    ).toBe(false);
  });

  it("is off in development even with DSN", () => {
    expect(isSentryEnabled({ NODE_ENV: "development", SENTRY_DSN: DSN })).toBe(false);
  });

  it("is off when NODE_ENV is unset (worker:dev) unless SENTRY_ENABLED=1", () => {
    expect(isSentryEnabled({ SENTRY_DSN: DSN })).toBe(false);
    expect(isSentryEnabled({ SENTRY_DSN: DSN, SENTRY_ENABLED: "1" })).toBe(true);
  });

  it("allows local opt-in via SENTRY_ENABLE_DEV or SENTRY_ENABLED", () => {
    expect(
      isSentryEnabled({ NODE_ENV: "development", SENTRY_DSN: DSN, SENTRY_ENABLE_DEV: "1" }),
    ).toBe(true);
    expect(
      isSentryEnabled({ NODE_ENV: "development", SENTRY_DSN: DSN, SENTRY_ENABLED: "true" }),
    ).toBe(true);
  });

  it("is off in test unless explicitly enabled", () => {
    expect(isSentryEnabled({ NODE_ENV: "test", SENTRY_DSN: DSN })).toBe(false);
  });
});

describe("sentryEnvironment / traces", () => {
  it("falls back to NODE_ENV then development", () => {
    expect(sentryEnvironment({ SENTRY_ENVIRONMENT: "staging" })).toBe("staging");
    expect(sentryEnvironment({ NODE_ENV: "production" })).toBe("production");
    expect(sentryEnvironment({})).toBe("development");
  });

  it("defaults traces sample rate to 0", () => {
    expect(sentryTracesSampleRate({})).toBe(0);
    expect(sentryTracesSampleRate({ SENTRY_TRACES_SAMPLE_RATE: "0.2" })).toBe(0.2);
    expect(sentryTracesSampleRate({ SENTRY_TRACES_SAMPLE_RATE: "nope" })).toBe(0);
  });
});

describe("reportError", () => {
  it("does not throw when Sentry is off", () => {
    expect(() => reportError(new Error("noop"))).not.toThrow();
  });
});
