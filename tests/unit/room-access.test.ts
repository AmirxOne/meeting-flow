import { describe, it, expect } from "vitest";
import {
  assertRoomManageAccess,
  isRoomManagerScoped,
} from "@/server/services/room-access.service";
import { HttpError } from "@/server/auth/session";

const roomManager = {
  id: "rm1",
  isSuperAdmin: false,
  roleKeys: ["ROOM_MANAGER"],
  permissions: new Set(["room:update"]),
} as const;

const admin = {
  id: "admin1",
  isSuperAdmin: false,
  roleKeys: ["ADMIN"],
  permissions: new Set(["room:update"]),
} as const;

describe("room manager RBAC", () => {
  it("detects scoped room managers", () => {
    expect(isRoomManagerScoped(roomManager as never)).toBe(true);
    expect(isRoomManagerScoped(admin as never)).toBe(false);
  });

  it("allows room manager on assigned room", () => {
    expect(() => assertRoomManageAccess(roomManager as never, { managerId: "rm1" })).not.toThrow();
  });

  it("blocks room manager on other rooms", () => {
    expect(() => assertRoomManageAccess(roomManager as never, { managerId: "other" })).toThrow(HttpError);
    try {
      assertRoomManageAccess(roomManager as never, { managerId: null });
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(403);
    }
  });

  it("allows admin on any room", () => {
    expect(() => assertRoomManageAccess(admin as never, { managerId: null })).not.toThrow();
  });
});
