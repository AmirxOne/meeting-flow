import { appPageTitle } from "@/lib/app-page-title";
import { DashboardPage } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("داشبورد");
}

export default function Page() {
  return <DashboardPage />;
}
