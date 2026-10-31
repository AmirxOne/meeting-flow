import { appPageTitle } from "@/lib/app-page-title";
import { MyPrograms } from "@/components/appointments/appointments-section";

export async function generateMetadata() {
  return appPageTitle("برنامه‌های من");
}

export default function Page() {
  return <MyPrograms />;
}
