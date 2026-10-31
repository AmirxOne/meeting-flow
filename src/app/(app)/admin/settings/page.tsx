import { appPageTitle } from "@/lib/app-page-title";
import { AdminSettingsPage } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("تنظیمات");
}

export default function Page() {
  return <AdminSettingsPage />;
}
