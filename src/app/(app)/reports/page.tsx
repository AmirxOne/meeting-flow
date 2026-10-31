import { appPageTitle } from "@/lib/app-page-title";
import { ReportsPage } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("گزارش‌های سازمان");
}

export default function Page() {
  return <ReportsPage />;
}
