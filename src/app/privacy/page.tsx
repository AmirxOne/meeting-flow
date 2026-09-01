import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page";
import { privacyDocument } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "حریم خصوصی — مهرسا",
  description: privacyDocument.subtitle,
};

export default function PrivacyPage() {
  return <LegalPageShell doc={privacyDocument} />;
}
