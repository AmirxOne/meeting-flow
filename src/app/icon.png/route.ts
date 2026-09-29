import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { readOrgLogo } from "@/server/services/org-logo.service";
import { SAMPLE_ORG_SLUG } from "@/lib/org-slug";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /icon.png — favicon داینامیک: لوگوی سازمان (نقطه‌ی مرکزی تنظیمات).
 * اگر سازمان لوگو نداشته باشد 404 برمی‌گرداند و مرورگر به favicon.ico پیش‌فرض برمی‌گردد.
 * Next.js metadata این route را به‌عنوان آیکون تب تزریق می‌کند (metadata.icons آن را override می‌کند).
 */
export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug")?.trim().toLowerCase() || null;
    const org = await prisma.organization.findFirst({
      where: slug ? { slug } : {},
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    if (!org) return new NextResponse(null, { status: 404 });
    const file = await readOrgLogo(org.id);
    if (!file) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(file.body), {
      headers: {
        "content-type": file.mimeType,
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
