import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";

/** Ensure floorId belongs to branchId when assigning a room to a floor. */
export async function assertFloorInBranch(branchId: string, floorId: string | null | undefined) {
  if (!floorId) return;
  const floor = await prisma.floor.findFirst({ where: { id: floorId, branchId } });
  if (!floor) {
    throw new HttpError(400, "طبقه انتخاب‌شده متعلق به این شعبه نیست", "INVALID_FLOOR");
  }
}
