import { appPageTitle } from "@/lib/app-page-title";
import { AdminPoliciesPage } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("سیاست‌ها");
}

export default function Page() {
  return <AdminPoliciesPage />;
}
