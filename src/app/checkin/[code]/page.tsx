import { PublicCheckinPage } from "./page-client";
import type { Metadata } from "next";
import { serverOrgName } from "@/lib/server-org-name";

export async function generateMetadata(): Promise<Metadata> {
  const org = await serverOrgName();
  return {
    title: `ثبت‌حضور در جلسه — ${org}`,
    robots: { index: false },
  };
}

export default function Page() {
  return <PublicCheckinPage />;
}
