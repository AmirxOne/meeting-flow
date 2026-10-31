import { appPageTitle } from "@/lib/app-page-title";
import { MeetingsPage } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("جلسات");
}

export default function Page() {
  return <MeetingsPage />;
}
