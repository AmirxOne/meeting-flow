import { appPageTitle } from "@/lib/app-page-title";
import { redirect } from "next/navigation";

export async function generateMetadata() {
  return appPageTitle("افراد");
}



export default function PeoplePage() {

  redirect("/users");

}