import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "راه‌اندازی اولیه‌ی سازمان — مهرسا" },
  robots: { index: false },
};

import { redirect } from "next/navigation";
import { platformNeedsSetup } from "@/server/services/platform-setup.service";
import { OrgSetupPage } from "./page-client";

export default async function StartPage() {
  if (!(await platformNeedsSetup())) redirect("/login");
  return <OrgSetupPage />;
}
