import { appPageTitle } from "@/lib/app-page-title";
import { NotificationsPage } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("اعلان‌ها");
}

export default function Page() {
  return <NotificationsPage />;
}
