import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page";
import { privacyDocument } from "@/lib/legal-content";
import { serverOrgName } from "@/lib/server-org-name";

export async function generateMetadata(): Promise<Metadata> {
  const orgName = await serverOrgName();
  return {
  alternates: { canonical: "/privacy" },
  title: { absolute: `حریم خصوصی — ${orgName}` },
  description: privacyDocument.subtitle,
  };
}

export default function PrivacyPage() {
  return <LegalPageShell doc={privacyDocument} />;
}
