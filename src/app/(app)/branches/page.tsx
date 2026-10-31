import { appPageTitle } from "@/lib/app-page-title";
import { BranchesPage } from "./page-client";

export async function generateMetadata() {
  return appPageTitle("شعب");
}

export default function Page() {
  return <BranchesPage />;
}
