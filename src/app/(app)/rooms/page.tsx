import { appPageTitle } from "@/lib/app-page-title";
import { RoomsPage } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("اتاق‌ها");
}

export default function Page() {
  return <RoomsPage />;
}
