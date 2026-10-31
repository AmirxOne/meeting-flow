import { appPageTitle } from "@/lib/app-page-title";
import { MyReportsClient } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("گزارش من");
}

export default function Page() {
  return <MyReportsClient />;
}
