import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { readOrgLogo } from "@/server/services/org-logo.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /icon.png — favicon داینامیک از نقطه‌ی مرکزی برندینگ:
 * لوگوی سازمان اگر آپلود شده باشد؛ وگرنه SVG خنثی مونوگرام (حرف اول نام سازمان)
 * — هیچ لوگوی پیش‌فرضی نمایش داده نمی‌شود، همان سیاست برند-مرکزی UI.
 */
export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug")?.trim().toLowerCase() || null;
    const org = await prisma.organization.findFirst({
      where: slug ? { slug } : {},
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    if (org) {
      const file = await readOrgLogo(org.id);
      if (file) {
        return new NextResponse(new Uint8Array(file.body), {
          headers: {
            "content-type": file.mimeType,
            "cache-control": "public, max-age=60, stale-while-revalidate=300",
          },
        });
      }
    }

    // بدون لوگوی سازمانی — مونوگرام حرف اول نام سازمان (خنثی، بدون برند)
    const name = org?.name?.trim() || "";
    const ch = name.charAt(0) || "•";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#f3f3f4"/><text x="32" y="41" font-family="Tahoma,Arial,sans-serif" font-size="30" font-weight="700" fill="#52525b" text-anchor="middle">${ch}</text></svg>`;
    return new NextResponse(svg, {
      headers: {
        "content-type": "image/svg+xml",
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
