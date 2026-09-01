import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpError } from "@/server/auth/session";

vi.mock("@/server/db", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/server/services/attachment-storage", () => ({
  writeAttachment: vi.fn(),
  removeAttachmentFile: vi.fn(),
  readAttachmentBuffer: vi.fn(),
}));

import { prisma } from "@/server/db";
import {
  readAttachmentBuffer,
  removeAttachmentFile,
  writeAttachment,
} from "@/server/services/attachment-storage";
import {
  deleteOwnAvatar,
  readOrgAvatar,
  saveOwnAvatar,
  sniffAvatarImage,
} from "@/server/services/avatar.service";
import type { AuthUser } from "@/server/auth/session";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const PDF = Buffer.from("%PDF-1.1\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

const actor = {
  id: "u1",
  orgId: "org-a",
  isPlatformAdmin: false,
} as AuthUser;

describe("sniffAvatarImage", () => {
  it("accepts png", () => {
    expect(sniffAvatarImage(PNG, "me.png")).toEqual({ mime: "image/png", ext: "png" });
  });

  it("rejects pdf", () => {
    expect(() => sniffAvatarImage(PDF, "me.pdf")).toThrow(HttpError);
    try {
      sniffAvatarImage(PDF, "me.pdf");
    } catch (e) {
      expect((e as HttpError).code).toBe("FILE_TYPE");
    }
  });

  it("rejects oversized buffers", () => {
    const huge = Buffer.alloc(2 * 1024 * 1024 + 1, 0xff);
    try {
      sniffAvatarImage(huge, "big.jpg");
      throw new Error("expected throw");
    } catch (e) {
      expect((e as HttpError).code).toBe("FILE_TOO_LARGE");
    }
  });
});

describe("saveOwnAvatar / deleteOwnAvatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u1",
      orgId: "org-a",
      isActive: true,
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    vi.mocked(writeAttachment).mockResolvedValue();
    vi.mocked(removeAttachmentFile).mockResolvedValue();
  });

  it("writes the file and stores a public avatarUrl", async () => {
    const result = await saveOwnAvatar("u1", { buffer: PNG, name: "me.png" });
    expect(writeAttachment).toHaveBeenCalledWith("avatars/org-a/u1.png", PNG);
    expect(result.avatarUrl).toMatch(/^\/api\/avatars\/u1\?v=\d+$/);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: { avatarUrl: result.avatarUrl },
      }),
    );
  });

  it("clears files and nulls avatarUrl", async () => {
    await deleteOwnAvatar("u1");
    expect(removeAttachmentFile).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { avatarUrl: null },
    });
  });
});

describe("readOrgAvatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("404s when another org asks", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u-beta",
      orgId: "org-b",
      avatarUrl: "/api/avatars/u-beta",
    } as never);
    await expect(readOrgAvatar(actor, "u-beta")).rejects.toMatchObject({
      status: 404,
      code: "NO_AVATAR",
    });
    expect(readAttachmentBuffer).not.toHaveBeenCalled();
  });

  it("streams same-org file", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "u2",
      orgId: "org-a",
      avatarUrl: "/api/avatars/u2",
    } as never);
    vi.mocked(readAttachmentBuffer).mockImplementation(async (key: string) => {
      if (String(key).endsWith(".png")) return PNG;
      const err = new Error("missing") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      throw err;
    });
    const file = await readOrgAvatar(actor, "u2");
    expect(file.mimeType).toBe("image/png");
    expect(file.body).toEqual(PNG);
  });
});
