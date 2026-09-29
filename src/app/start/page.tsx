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

export default async function StartPage() {
  if (!(await platformNeedsSetup())) redirect("/login");
  return <OrgSetupPage />;
}
