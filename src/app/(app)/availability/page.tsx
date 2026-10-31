import { appPageTitle } from "@/lib/app-page-title";
import { AvailabilityPage } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("زمان مناسب");
}

export default function Page() {
  return <AvailabilityPage />;
}
