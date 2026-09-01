import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseSmsProviderKind,
  createSmsProvider,
  KavenegarSmsProvider,
  normalizeSmsPhone,
  formatSmsError,
  describeSmsRuntime,
  isValidIranMobile,
  resetSmsProviderCache,
} from "@/server/services/sms-provider";

describe("parseSmsProviderKind", () => {
  it("defaults to mock when unset or empty", () => {
    expect(parseSmsProviderKind(undefined, {})).toBe("mock");
    expect(parseSmsProviderKind("", {})).toBe("mock");
    expect(parseSmsProviderKind("  ", {})).toBe("mock");
  });

  it("recognizes kavenegar case-insensitively", () => {
    expect(parseSmsProviderKind("kavenegar")).toBe("kavenegar");
    expect(parseSmsProviderKind("Kavenegar")).toBe("kavenegar");
  });

  it("falls back to mock for unknown providers", () => {
    expect(parseSmsProviderKind("console")).toBe("mock");
    expect(parseSmsProviderKind("twilio")).toBe("mock");
  });
});

describe("createSmsProvider", () => {
  afterEach(() => {
    resetSmsProviderCache();
  });

  it("returns mock provider by default", () => {
    const p = createSmsProvider({ provider: "mock" });
    expect(p.name).toBe("mock-sms");
  });

  it("requires API key and sender for kavenegar", () => {
    expect(() => createSmsProvider({ provider: "kavenegar", env: {} })).toThrow(/SMS_API_KEY/);
    expect(() =>
      createSmsProvider({ provider: "kavenegar", apiKey: "key", env: {} }),
    ).toThrow(/SMS_FROM/);
  });

  it("creates kavenegar provider when credentials supplied", () => {
    const p = createSmsProvider({
      provider: "kavenegar",
      apiKey: "test-key",
      sender: "10004346",
    });
    expect(p.name).toBe("kavenegar");
  });

  it("uses SMS_API_KEY from env for a real Kavenegar provider", () => {
    const fetchMock = vi.fn();
    const p = createSmsProvider({
      provider: "kavenegar",
      env: { SMS_API_KEY: "env-secret-key", SMS_FROM: "10004346" },
      fetchFn: fetchMock,
    });
    expect(p.name).toBe("kavenegar");
  });
});

describe("normalizeSmsPhone / isValidIranMobile", () => {
  it("strips formatting and converts +98 to 0", () => {
    expect(normalizeSmsPhone("+98 912 123 4567")).toBe("09121234567");
    expect(normalizeSmsPhone("989121234567")).toBe("09121234567");
  });

  it("accepts 09xxxxxxxxx", () => {
    expect(isValidIranMobile("09121234567")).toBe(true);
    expect(isValidIranMobile("0912")).toBe(false);
  });
});

describe("formatSmsError", () => {
  it("strips URLs so the API key in the path is not stored", () => {
    expect(
      formatSmsError(new Error("fail https://api.kavenegar.com/v1/SECRET/sms/send.json")),
    ).toBe("fail [kavenegar]");
  });
});

describe("describeSmsRuntime", () => {
  it("does not include the API key and keeps mock as default", () => {
    const s = describeSmsRuntime(
      { NOTIFICATION_SMS_PROVIDER: "mock", SMS_API_KEY: "secret", SMS_FROM: "1000" },
      ["IN_APP", "SMS"],
    );
    expect(s.provider).toBe("mock");
    expect(s.configured).toBe(false);
    expect(s.hasApiKey).toBe(true);
    expect(s.sender).toBe("1000");
    expect(s.reminderSmsEnabled).toBe(true);
    expect(JSON.stringify(s)).not.toContain("secret");
  });

  it("marks kavenegar configured when key + sender are set", () => {
    const s = describeSmsRuntime({
      NOTIFICATION_SMS_PROVIDER: "kavenegar",
      SMS_API_KEY: "secret",
      SMS_FROM: "10004346",
      SMS_TEMPLATE: "mehrsa-reminder",
    });
    expect(s.configured).toBe(true);
    expect(s.template).toBe("mehrsa-reminder");
  });
});

describe("KavenegarSmsProvider", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function okJson(status = 200, message = "تایید شد") {
    return {
      ok: true,
      json: async () => ({ return: { status, message } }),
    };
  }

  it("POSTs to Kavenegar send API and succeeds on status 200", async () => {
    fetchMock.mockResolvedValue(okJson());

    const provider = new KavenegarSmsProvider("api-key", "10004346", fetchMock);
    await provider.send("09121234567", "سلام");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api.kavenegar.com/v1/api-key/sms/send.json");
    expect(init.method).toBe("POST");
    const body = init.body as URLSearchParams;
    expect(body.get("receptor")).toBe("09121234567");
    expect(body.get("sender")).toBe("10004346");
    expect(body.get("message")).toBe("سلام");
  });

  it("POSTs verify/lookup.json when a قالبکد template is set", async () => {
    fetchMock.mockResolvedValue(okJson());

    const provider = new KavenegarSmsProvider("api-key", "10004346", fetchMock, "mehrsa-reminder");
    await provider.send("09121234567", "ignored body", {
      token: "30",
      token2: "جلسه فروش",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api.kavenegar.com/v1/api-key/verify/lookup.json");
    const body = init.body as URLSearchParams;
    expect(body.get("template")).toBe("mehrsa-reminder");
    expect(body.get("token")).toBe("30");
    expect(body.get("token2")).toBe("جلسه-فروش");
    expect(body.get("message")).toBeNull();
  });

  it("throws when Kavenegar returns non-200 status in body", async () => {
    fetchMock.mockResolvedValue(okJson(418, "خطا"));

    const provider = new KavenegarSmsProvider("key", "10004346", fetchMock);
    await expect(provider.send("09120000000", "test")).rejects.toThrow(/Kavenegar/);
  });

  it("throws on HTTP error and includes API message when present", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ return: { status: 502, message: "gateway" } }),
    });

    const provider = new KavenegarSmsProvider("key", "10004346", fetchMock);
    await expect(provider.send("09120000000", "test")).rejects.toThrow(/502/);
  });
});
