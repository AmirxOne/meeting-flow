import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page";
import { termsDocument } from "@/lib/legal-content";
import { serverOrgName } from "@/lib/server-org-name";

// این صفحه runtime از DB می‌خواند — prerender در build (بدون DB) ممکن نیست
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const orgName = await serverOrgName();
  return {
  alternates: { canonical: "/terms" },
  title: { absolute: `شرایط استفاده — ${orgName}` },
  description: termsDocument.subtitle,
  };
}

export default function TermsPage() {
  return <LegalPageShell doc={termsDocument} />;
}
