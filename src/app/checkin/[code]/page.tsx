import { PublicCheckinPage } from "./page-client";
import type { Metadata } from "next";
import { serverOrgName } from "@/lib/server-org-name";

// این صفحه runtime از DB می‌خواند — prerender در build (بدون DB) ممکن نیست
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const org = await serverOrgName();
  return {
    title: org ? `ثبت‌حضور در جلسه — ${org}` : "ثبت‌حضور در جلسه",
    robots: { index: false },
  };
}

export default function Page() {
  return <PublicCheckinPage />;
}
