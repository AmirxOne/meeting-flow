import { redirect } from "next/navigation";
import { platformNeedsSetup } from "@/server/services/platform-setup.service";
import { OrgSetupPage } from "./page-client";

export default async function StartPage() {
  if (!(await platformNeedsSetup())) redirect("/login");
  return <OrgSetupPage />;
}
