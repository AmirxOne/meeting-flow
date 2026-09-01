import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/legal-page";
import { dataRetentionDocument } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "نگهداری داده — مهرسا",
  description: dataRetentionDocument.subtitle,
};

export default function DataRetentionPage() {
  return <LegalPageShell doc={dataRetentionDocument} />;
}
