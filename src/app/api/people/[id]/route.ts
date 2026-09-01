import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser, requirePermission, HttpError } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";

const updateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  kind: z.enum(["INTERNAL", "EXTERNAL"]).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  company: z.string().trim().max(100).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(100).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

/** PATCH /api/people/:id — edit a directory entry. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser();
    const { id } = await params;
    const input = updateSchema.parse(await req.json().catch(() => ({})));

    const person = await prisma.personDirectory.findFirst({ where: { id, orgId: actor.orgId } });
    if (!person) throw new HttpError(404, "فرد یافت نشد", "NOT_FOUND");

    const updated = await prisma.personDirectory.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
        ...(input.email !== undefined ? { email: input.email || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.company !== undefined ? { company: input.company || null } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle || null } : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      },
    });
    await audit({
      actorId: actor.id,
      action: "UPDATE",
      entity: "PersonDirectory",
      entityId: id,
      oldValue: { name: person.name, kind: person.kind },
      newValue: { name: updated.name, kind: updated.kind },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ person: updated });
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE /api/people/:id — remove from directory (history-safe). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser();
    const { id } = await params;

    const person = await prisma.personDirectory.findFirst({ where: { id, orgId: actor.orgId } });
    if (!person) throw new HttpError(404, "فرد یافت نشد", "NOT_FOUND");

    // directory entry deletion is history-safe: meeting guests/participants
    // store their own copies; we only remove the pickable directory entry.
    await prisma.personDirectory.delete({ where: { id } });

    await audit({
      actorId: actor.id,
      action: "DELETE",
      entity: "PersonDirectory",
      entityId: id,
      oldValue: { name: person.name, kind: person.kind },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
