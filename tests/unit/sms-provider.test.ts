import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseSmsProviderKind,
  createSmsProvider,
  KavenegarSmsProvider,
  normalizeSmsPhone,
} from "@/server/services/sms-provider";

describe("parseSmsProviderKind", () => {
  it("defaults to mock when unset or empty", () => {
    expect(parseSmsProviderKind(undefined)).toBe("mock");
    expect(parseSmsProviderKind("")).toBe("mock");
    expect(parseSmsProviderKind("  ")).toBe("mock");
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
  it("returns mock provider by default", () => {
    const p = createSmsProvider({ provider: "mock" });
    expect(p.name).toBe("mock-sms");
  });

  it("requires API key and sender for kavenegar", () => {
    expect(() => createSmsProvider({ provider: "kavenegar" })).toThrow(/SMS_API_KEY/);
    expect(() =>
      createSmsProvider({ provider: "kavenegar", apiKey: "key" }),
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
});

describe("normalizeSmsPhone", () => {
  it("strips formatting and converts +98 to 0", () => {
    expect(normalizeSmsPhone("+98 912 123 4567")).toBe("09121234567");
    expect(normalizeSmsPhone("989121234567")).toBe("09121234567");
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

  it("POSTs to Kavenegar send API and succeeds on status 200", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ return: { status: 200, message: "تایید شد" } }),
    });

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

  it("throws when Kavenegar returns non-200 status in body", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ return: { status: 418, message: "خطا" } }),
    });

    const provider = new KavenegarSmsProvider("key", "10004346", fetchMock);
    await expect(provider.send("09120000000", "test")).rejects.toThrow(/Kavenegar/);
  });

  it("throws on HTTP error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });

    const provider = new KavenegarSmsProvider("key", "10004346", fetchMock);
    await expect(provider.send("09120000000", "test")).rejects.toThrow(/502/);
  });
});
