import { HttpError } from "@/server/auth/session";
import type { AuthUser } from "@/server/auth/session";

const ELEVATED_ROOM_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "BRANCH_MANAGER"]);

/** ROOM_MANAGER may only PATCH/disable/exclude rooms they manage. */
export function isRoomManagerScoped(user: AuthUser): boolean {
  if (user.isSuperAdmin) return false;
  if (user.roleKeys.some((k) => ELEVATED_ROOM_ROLES.has(k))) return false;
  return user.roleKeys.includes("ROOM_MANAGER");
}

export function assertRoomManageAccess(
  actor: AuthUser,
  room: { managerId: string | null },
): void {
  if (!isRoomManagerScoped(actor)) return;
  if (room.managerId === actor.id) return;
  throw new HttpError(
    403,
    "فقط اتاق‌های تحت مدیریت خود را می‌توانید ویرایش کنید",
    "FORBIDDEN",
  );
}
