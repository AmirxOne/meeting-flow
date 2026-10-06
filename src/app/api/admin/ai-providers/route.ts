import { NextRequest } from "next/server";
import { requirePermission } from "@/server/auth/session";
import { ok, handleError, audit } from "@/server/http";
import { z } from "zod";
import {
  listProviders,
  saveProvider,
  deleteProvider,
  PROVIDER_SPECS,
} from "@/server/services/ai-provider.service";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  id: z.string().optional(),
  specId: z.string().min(1),
  name: z.string().trim().max(80),
  baseUrl: z.string().trim().max(300),
  model: z.string().trim().max(120).nullable(),
  apiKey: z.string().trim().max(400).optional(),
  enabled: z.boolean(),
});

/** GET — پروایدرها (کلید همیشه ماسک‌شده) + رجیستری specs */
export async function GET() {
  try {
    await requirePermission("org:manage");
    return ok({ providers: await listProviders(), specs: PROVIDER_SPECS });
  } catch (e) {
    return handleError(e);
  }
}

/** POST — ثبت/ویرایش. کلید خام فقط اینجا می‌آید و همان‌جا seal می‌شود. */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("org:manage");
    const input = saveSchema.parse(await req.json().catch(() => ({})));
    const p = await saveProvider(input);
    await audit({
      actorId: user.id,
      action: "CREATE",
      entity: "AiProvider",
      entityId: p.id,
      // عمداً بدون apiKey — در لاگ ممیزی هم کلید نمی‌نشیند
      newValue: { name: p.name, specId: p.specId, baseUrl: p.baseUrl, model: p.model, enabled: p.enabled },
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok(p);
  } catch (e) {
    return handleError(e);
  }
}

/** DELETE — حذف پروایدر */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requirePermission("org:manage");
    const { id } = z.object({ id: z.string() }).parse(await req.json().catch(() => ({})));
    await deleteProvider(id);
    await audit({
      actorId: user.id,
      action: "DELETE",
      entity: "AiProvider",
      entityId: id,
      ip: req.headers.get("x-forwarded-for"),
    });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
