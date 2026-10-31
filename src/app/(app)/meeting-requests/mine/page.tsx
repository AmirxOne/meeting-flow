import { appPageTitle } from "@/lib/app-page-title";
import { MyRequestsPage } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("درخواست‌های من");
}

export default function Page() {
  return <MyRequestsPage />;
}
