import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page";
import { termsDocument } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "شرایط استفاده — مهرسا",
  description: termsDocument.subtitle,
};

export default function TermsPage() {
  return <LegalPageShell doc={termsDocument} />;
}
