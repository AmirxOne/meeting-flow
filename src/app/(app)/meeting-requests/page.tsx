import { appPageTitle } from "@/lib/app-page-title";
import { MeetingRequestForm } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("درخواست جلسه");
}

export default function Page() {
  return <MeetingRequestForm />;
}
