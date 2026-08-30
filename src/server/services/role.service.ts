import { prisma } from "@/server/db";
import { HttpError } from "@/server/auth/session";
import { PERMISSIONS, PERMISSION_KEYS } from "@/server/auth/permissions";
import type { roleCreateSchema, roleUpdateSchema } from "@/lib/validations";
import type { z } from "zod";

export type RoleCreateInput = z.infer<typeof roleCreateSchema>;
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;

const roleInclude = {
  permissions: { include: { permission: { select: { key: true, name: true, group: true } } } },
  _count: { select: { users: true } },
} as const;

export function serializeRole(role: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissions: { permission: { key: string; name: string; group: string } }[];
  _count?: { users: number };
}) {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    userCount: role._count?.users ?? 0,
    permissionKeys: role.permissions.map((p) => p.permission.key),
    permissions: role.permissions.map((p) => p.permission),
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

export function getPermissionCatalog() {
  const groups = new Map<string, { key: string; name: string }[]>();
  for (const key of PERMISSION_KEYS) {
    const meta = PERMISSIONS[key];
    const list = groups.get(meta.group) ?? [];
    list.push({ key, name: meta.name });
    groups.set(meta.group, list);
  }
  return [...groups.entries()].map(([group, permissions]) => ({ group, permissions }));
}

function assertKnownPermissions(keys: string[]) {
  const unknown = keys.filter((k) => !PERMISSION_KEYS.includes(k as (typeof PERMISSION_KEYS)[number]));
  if (unknown.length) {
    throw new HttpError(400, `دسترسی‌های نامعتبر: ${unknown.join(", ")}`, "BAD_PERMISSIONS");
  }
}

export async function listRoles() {
  const roles = await prisma.role.findMany({
    include: roleInclude,
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  return roles.map(serializeRole);
}

export async function createRole(input: RoleCreateInput) {
  assertKnownPermissions(input.permissionKeys);
  const exists = await prisma.role.findUnique({ where: { key: input.key } });
  if (exists) throw new HttpError(409, "کلید نقش تکراری است", "DUPLICATE");

  const perms = await prisma.permission.findMany({ where: { key: { in: input.permissionKeys } } });
  const role = await prisma.role.create({
    data: {
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      isSystem: false,
      permissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
    include: roleInclude,
  });
  return serializeRole(role);
}

export async function updateRole(roleId: string, input: RoleUpdateInput) {
  const role = await prisma.role.findUnique({ where: { id: roleId }, include: roleInclude });
  if (!role) throw new HttpError(404, "نقش یافت نشد", "NOT_FOUND");
  if (role.isSystem) throw new HttpError(403, "نقش‌های سیستمی قابل ویرایش نیستند", "SYSTEM_ROLE");

  if (input.permissionKeys) {
    assertKnownPermissions(input.permissionKeys);
    const perms = await prisma.permission.findMany({ where: { key: { in: input.permissionKeys } } });
    await prisma.rolePermission.deleteMany({ where: { roleId } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId, permissionId: p.id })),
    });
  }

  const updated = await prisma.role.update({
    where: { id: roleId },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
    include: roleInclude,
  });
  return serializeRole(updated);
}

export async function deleteRole(roleId: string) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { _count: { select: { users: true } } },
  });
  if (!role) throw new HttpError(404, "نقش یافت نشد", "NOT_FOUND");
  if (role.isSystem) throw new HttpError(403, "نقش‌های سیستمی قابل حذف نیستند", "SYSTEM_ROLE");
  if (role._count.users > 0) {
    throw new HttpError(409, "این نقش به کاربران اختصاص داده شده است", "ROLE_IN_USE");
  }
  await prisma.role.delete({ where: { id: roleId } });
}
