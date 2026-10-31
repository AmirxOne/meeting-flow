import { appPageTitle } from "@/lib/app-page-title";
import { redirect } from "next/navigation";

export async function generateMetadata() {
  return appPageTitle("برنامه‌ها");
}

export default function Page() {
  redirect("/dashboard");
}
