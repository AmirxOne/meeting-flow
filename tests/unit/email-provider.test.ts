import { describe, it, expect, vi, afterEach } from "vitest";
import type { Transporter } from "nodemailer";
import {
  parseEmailProviderKind,
  parseSmtpPort,
  resolveSmtpConfig,
  createEmailProvider,
  SmtpEmailProvider,
  formatEmailError,
  resetEmailProviderCache,
} from "@/server/services/email-provider";

describe("parseEmailProviderKind", () => {
  it("defaults to mock when unset or empty", () => {
    expect(parseEmailProviderKind(undefined, {})).toBe("mock");
    expect(parseEmailProviderKind("", {})).toBe("mock");
  });

  it("recognizes smtp case-insensitively", () => {
    expect(parseEmailProviderKind("smtp")).toBe("smtp");
    expect(parseEmailProviderKind("SMTP")).toBe("smtp");
  });

  it("falls back to mock for unknown providers", () => {
    expect(parseEmailProviderKind("sendgrid")).toBe("mock");
  });
});

describe("parseSmtpPort", () => {
  it("defaults to 587", () => {
    expect(parseSmtpPort(undefined)).toBe(587);
    expect(parseSmtpPort("")).toBe(587);
  });

  it("parses numeric port", () => {
    expect(parseSmtpPort("465")).toBe(465);
    expect(parseSmtpPort(2525)).toBe(2525);
  });
});

describe("resolveSmtpConfig", () => {
  it("returns null when host or from missing", () => {
    expect(resolveSmtpConfig({ host: "smtp.test", from: "", env: {} })).toBeNull();
    expect(resolveSmtpConfig({ host: "", from: "a@b.com", env: {} })).toBeNull();
  });

  it("builds config from SMTP_* overrides", () => {
    expect(
      resolveSmtpConfig({
        host: "smtp.test",
        port: 465,
        secure: true,
        user: "u",
        pass: "p",
        from: "noreply@test.com",
        env: {},
      }),
    ).toEqual({
      host: "smtp.test",
      port: 465,
      secure: true,
      user: "u",
      pass: "p",
      from: "noreply@test.com",
    });
  });

  it("reads SMTP_HOST / SMTP_FROM from env", () => {
    const cfg = resolveSmtpConfig({
      env: {
        SMTP_HOST: "smtp.env.test",
        SMTP_PORT: "2525",
        SMTP_FROM: "from@env.test",
        SMTP_USER: "user",
        SMTP_PASS: "secret",
      },
    });
    expect(cfg).toMatchObject({
      host: "smtp.env.test",
      port: 2525,
      from: "from@env.test",
      user: "user",
      pass: "secret",
    });
  });
});

describe("formatEmailError", () => {
  it("truncates and strips URLs for MeetingReminder.lastError", () => {
    expect(formatEmailError(new Error("connect https://smtp.example/x failed"))).toBe(
      "connect [smtp] failed",
    );
  });
});

describe("createEmailProvider", () => {
  afterEach(() => {
    resetEmailProviderCache();
  });

  it("returns mock provider by default", () => {
    const p = createEmailProvider({ provider: "mock" });
    expect(p.name).toBe("mock-email");
  });

  it("requires SMTP host and from for smtp", () => {
    expect(() => createEmailProvider({ provider: "smtp", env: {} })).toThrow(/SMTP_HOST/);
    expect(() =>
      createEmailProvider({ provider: "smtp", host: "smtp.test", env: {} }),
    ).toThrow(/SMTP_FROM/);
  });

  it("creates smtp provider with injected transporter", () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "1" });
    const transporter = { sendMail } as unknown as Transporter;

    const p = createEmailProvider({
      provider: "smtp",
      host: "smtp.test",
      from: "noreply@test.com",
      transporter,
      env: {},
    });

    expect(p.name).toBe("smtp");
  });
});

describe("SmtpEmailProvider", () => {
  it("calls transporter.sendMail with text and RTL html", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "abc" });
    const transporter = { sendMail } as unknown as Transporter;

    const provider = new SmtpEmailProvider("noreply@test.com", transporter);
    await provider.send("user@example.com", "موضوع", "متن");

    expect(sendMail).toHaveBeenCalledOnce();
    const arg = sendMail.mock.calls[0][0] as {
      from: string;
      to: string;
      subject: string;
      text: string;
      html: string;
    };
    expect(arg).toMatchObject({
      from: "noreply@test.com",
      to: "user@example.com",
      subject: "موضوع",
      text: "متن",
    });
    expect(arg.html).toContain('dir="rtl"');
    expect(arg.html).toContain("موضوع");
    expect(arg.html).toContain("متن");
  });

  it("uses the provided html when given", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "x" });
    const transporter = { sendMail } as unknown as Transporter;
    const provider = new SmtpEmailProvider("from@test.com", transporter);
    await provider.send("a@b.com", "س", "t", "<p dir=\"rtl\">html</p>");
    expect(sendMail.mock.calls[0][0].html).toBe("<p dir=\"rtl\">html</p>");
  });
});
