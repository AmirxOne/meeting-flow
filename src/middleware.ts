import { NextRequest, NextResponse } from "next/server";
import { ORG_COOKIE, ORG_SLUG_HEADER, requestedOrgSlug } from "@/lib/org-slug";

export function middleware(req: NextRequest) {
  const existing = req.headers.get(ORG_SLUG_HEADER);
  const slug =
    existing ||
    requestedOrgSlug({
      query: req.nextUrl.searchParams.get("org"),
      host: req.headers.get("host"),
      cookie: req.cookies.get(ORG_COOKIE)?.value ?? null,
    });

  if (!slug) return NextResponse.next();

  const headers = new Headers(req.headers);
  headers.set(ORG_SLUG_HEADER, slug);
  const res = NextResponse.next({ request: { headers } });
  if (!req.cookies.get(ORG_COOKIE)?.value) {
    res.cookies.set(ORG_COOKIE, slug, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.*\\.png|sw\\.js|offline\\.html|icons/|fonts/|apple-touch-icon\\.png).*)",
  ],
};
