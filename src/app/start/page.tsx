import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const orgName = await serverOrgName();
  return {
  title: { absolute: `راه‌اندازی اولیه‌ی سازمان — ${orgName}` },
  robots: { index: false },
  };
}

import { redirect } from "next/navigation";
import { platformNeedsSetup } from "@/server/services/platform-setup.service";
import { OrgSetupPage } from "./page-client";
import { serverOrgName } from "@/lib/server-org-name";

// این صفحه وضعیت دیتابیس را runtime چک می‌کند (آیا راه‌اندازی اولیه لازم است؟)
// — prerender در build ممکن نیست (DB در دسترس نیست)
export const dynamic = "force-dynamic";

export default async function StartPage() {
  if (!(await platformNeedsSetup())) redirect("/login");
  return <OrgSetupPage />;
}
