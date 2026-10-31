import { appPageTitle } from "@/lib/app-page-title";
import { AdminPage } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("مدیریت");
}

export default function Page() {
  return <AdminPage />;
}
