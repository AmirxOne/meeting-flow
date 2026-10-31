import { appPageTitle } from "@/lib/app-page-title";
import { AuditLogsPage } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("لاگ ممیزی");
}

export default function Page() {
  return <AuditLogsPage />;
}
