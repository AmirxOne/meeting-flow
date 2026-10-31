import { appPageTitle } from "@/lib/app-page-title";
import { UsersTabsPage } from "./tabs-page";

export async function generateMetadata() {
  return appPageTitle("اعضا");
}



export default function Page() {

  return <UsersTabsPage />;

}