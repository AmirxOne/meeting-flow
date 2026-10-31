import { appPageTitle } from "@/lib/app-page-title";
import { CalendarPage } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("تقویم");
}

export default function Page() {
  return <CalendarPage />;
}
