import type { Metadata } from "next";
import { serverOrgName } from "@/lib/server-org-name";
import { LegalPageShell } from "@/components/legal/legal-page";
import { dataRetentionDocument } from "@/lib/legal-content";

export async function generateMetadata(): Promise<Metadata> {
  const org = await serverOrgName();
  return {
    alternates: { canonical: "/data-retention" },
    title: { absolute: `نگهداری داده — ${org}` },
    description: dataRetentionDocument.subtitle,
  };
}

export default function DataRetentionPage() {
  return <LegalPageShell doc={dataRetentionDocument} />;
}
