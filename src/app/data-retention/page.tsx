import type { Metadata } from "next";
import { serverOrgName } from "@/lib/server-org-name";
import { LegalPageShell } from "@/components/legal/legal-page";
import { dataRetentionDocument } from "@/lib/legal-content";

// این صفحه runtime از DB می‌خواند — prerender در build (بدون DB) ممکن نیست
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const org = await serverOrgName();
  return {
    alternates: { canonical: "/data-retention" },
    title: { absolute: org ? `نگهداری داده — ${org}` : "نگهداری داده" },
    description: dataRetentionDocument.subtitle,
  };
}

export default function DataRetentionPage() {
  return <LegalPageShell doc={dataRetentionDocument} />;
}
