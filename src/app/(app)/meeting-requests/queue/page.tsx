import { appPageTitle } from "@/lib/app-page-title";
import { RequestQueuePage } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("هماهنگی درخواست‌ها");
}

export default function Page() {
  return <RequestQueuePage />;
}
