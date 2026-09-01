import { describe, expect, it } from "vitest";
import { HttpError } from "@/server/auth/session";
import {
  sanitizeOriginalName,
  sniffAttachment,
} from "@/server/services/attachment-scan";
import { resolveStoragePath } from "@/server/services/attachment-storage";
import {
  assertCanManageAttachments,
  assertCanViewMeeting,
} from "@/server/services/attachment.service";
import type { AuthUser } from "@/server/auth/session";

const PDF = Buffer.from("%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const MZ = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

function zipWith(marker: string): Buffer {
  return Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(`xxxx${marker}document.xml`)]);
}

function errCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof HttpError) return e.code;
  }
  return undefined;
}

describe("sniffAttachment", () => {
  it("accepts PDF, PNG, JPEG", () => {
    expect(sniffAttachment(PDF, "agenda.pdf")).toEqual({ mime: "application/pdf", ext: "pdf" });
    expect(sniffAttachment(PNG, "pic.png").mime).toBe("image/png");
    expect(sniffAttachment(JPEG, "photo.jpg").mime).toBe("image/jpeg");
    expect(sniffAttachment(JPEG, "photo.jpeg").ext).toBe("jpeg");
  });

  it("accepts OOXML when ZIP contains office markers", () => {
    expect(sniffAttachment(zipWith("word/"), "notes.docx").ext).toBe("docx");
    expect(sniffAttachment(zipWith("xl/"), "sheet.xlsx").ext).toBe("xlsx");
    expect(sniffAttachment(zipWith("ppt/"), "deck.pptx").ext).toBe("pptx");
  });

  it("rejects executables, HTML, generic ZIP, and extension mismatch", () => {
    expect(errCode(() => sniffAttachment(MZ, "virus.exe"))).toBe("FILE_TYPE");
    expect(errCode(() => sniffAttachment(MZ, "virus.pdf"))).toBe("FILE_TYPE");
    expect(errCode(() => sniffAttachment(Buffer.from("<!DOCTYPE html><html></html>"), "x.pdf"))).toBe("FILE_TYPE");
    expect(errCode(() => sniffAttachment(Buffer.concat([Buffer.from([0x50, 0x4b]), Buffer.from("no-office")]), "x.docx"))).toBe(
      "FILE_TYPE",
    );
    expect(errCode(() => sniffAttachment(PDF, "agenda.png"))).toBe("FILE_TYPE");
    expect(errCode(() => sniffAttachment(zipWith("word/"), "notes.xlsx"))).toBe("FILE_TYPE");
    expect(errCode(() => sniffAttachment(Buffer.alloc(0), "a.pdf"))).toBe("EMPTY_FILE");
  });

  it("strips path segments from original names", () => {
    expect(sanitizeOriginalName("..\\..\\etc\\passwd.pdf")).toBe("passwd.pdf");
    expect(sanitizeOriginalName("/tmp/a.pdf")).toBe("a.pdf");
  });
});

describe("attachment storage keys", () => {
  it("rejects path traversal", () => {
    expect(() => resolveStoragePath("../secret")).toThrow();
    expect(() => resolveStoragePath("a/../../etc/passwd")).toThrow();
    expect(() => resolveStoragePath("/etc/passwd")).toThrow();
  });

  it("accepts meetingId/uuid keys", () => {
    const p = resolveStoragePath("clxyz123/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(p.replace(/\\/g, "/")).toMatch(/clxyz123\/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee$/);
  });
});

function user(partial: Partial<AuthUser> & Pick<AuthUser, "id" | "permissions" | "roleKeys">): AuthUser {
  return {
    email: `${partial.id}@example.com`,
    fullName: partial.id,
    phone: null,
    avatarUrl: null,
    jobTitle: null,
    department: null,
    isSuperAdmin: false,
    isPlatformAdmin: false,
    orgId: "org-main",
    orgSlug: "sample",
    branchId: null,
    ...partial,
  };
}

const privateMeeting = {
  id: "m1",
  organizerId: "ali",
  isPrivate: true,
  participants: [{ userId: "ali" }, { userId: "amir" }],
};

const publicMeeting = { ...privateMeeting, isPrivate: false };

describe("attachment access", () => {
  const ali = user({
    id: "ali",
    roleKeys: ["EMPLOYEE"],
    permissions: new Set(["meeting:view", "meeting:create", "meeting:update"]),
  });
  const amir = user({
    id: "amir",
    roleKeys: ["EMPLOYEE"],
    permissions: new Set(["meeting:view", "meeting:create", "meeting:update"]),
  });
  const sara = user({
    id: "sara",
    roleKeys: ["BRANCH_MANAGER"],
    permissions: new Set(["meeting:view", "meeting:view-all", "meeting:update"]),
  });
  const superA = user({
    id: "root",
    isSuperAdmin: true,
    roleKeys: ["SUPER_ADMIN"],
    permissions: new Set(),
  });

  it("hides private meeting attachments from outsiders", () => {
    expect(() => assertCanViewMeeting(sara, privateMeeting)).toThrow(HttpError);
    expect(() => assertCanViewMeeting(amir, privateMeeting)).not.toThrow();
    expect(() => assertCanViewMeeting(superA, privateMeeting)).not.toThrow();
  });

  it("lets invitees view but not upload; organizer and managers can manage", () => {
    expect(() => assertCanManageAttachments(amir, publicMeeting)).toThrow(HttpError);
    expect(() => assertCanManageAttachments(ali, publicMeeting)).not.toThrow();
    expect(() => assertCanManageAttachments(sara, publicMeeting)).not.toThrow();
    expect(() => assertCanViewMeeting(amir, publicMeeting)).not.toThrow();
  });

  it("blocks managers from managing a private meeting they are not in", () => {
    expect(() => assertCanManageAttachments(sara, privateMeeting)).toThrow(HttpError);
    expect(() => assertCanManageAttachments(superA, privateMeeting)).not.toThrow();
  });
});
