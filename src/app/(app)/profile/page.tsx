import { appPageTitle } from "@/lib/app-page-title";
import { ProfilePage } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("پروفایل");
}

export default function Page() {
  return <ProfilePage />;
}
