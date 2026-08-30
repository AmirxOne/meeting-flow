import { describe, it, expect, vi } from "vitest";
import type { Transporter } from "nodemailer";
import {
  parseEmailProviderKind,
  parseSmtpPort,
  resolveSmtpConfig,
  createEmailProvider,
  SmtpEmailProvider,
} from "@/server/services/email-provider";

describe("parseEmailProviderKind", () => {
  it("defaults to mock when unset or empty", () => {
    expect(parseEmailProviderKind(undefined)).toBe("mock");
    expect(parseEmailProviderKind("")).toBe("mock");
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
    expect(resolveSmtpConfig({ host: "smtp.test", from: "" })).toBeNull();
    expect(resolveSmtpConfig({ host: "", from: "a@b.com" })).toBeNull();
  });

  it("builds config from overrides", () => {
    expect(
      resolveSmtpConfig({
        host: "smtp.test",
        port: 465,
        secure: true,
        user: "u",
        pass: "p",
        from: "noreply@test.com",
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
});

describe("createEmailProvider", () => {
  it("returns mock provider by default", () => {
    const p = createEmailProvider({ provider: "mock" });
    expect(p.name).toBe("mock-email");
  });

  it("requires SMTP host and from for smtp", () => {
    expect(() => createEmailProvider({ provider: "smtp" })).toThrow(/SMTP_HOST/);
    expect(() =>
      createEmailProvider({ provider: "smtp", host: "smtp.test" }),
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
    });

    expect(p.name).toBe("smtp");
  });
});

describe("SmtpEmailProvider", () => {
  it("calls transporter.sendMail with from, to, subject, text", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "abc" });
    const transporter = { sendMail } as unknown as Transporter;

    const provider = new SmtpEmailProvider("noreply@test.com", transporter);
    await provider.send("user@example.com", "موضوع", "متن");

    expect(sendMail).toHaveBeenCalledWith({
      from: "noreply@test.com",
      to: "user@example.com",
      subject: "موضوع",
      text: "متن",
    });
  });
});
