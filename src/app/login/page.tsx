import { redirect } from "next/navigation";
import { platformNeedsSetup } from "@/server/services/platform-setup.service";
import { LoginPage } from "./page-client";

export default async function Page() {
  if (await platformNeedsSetup()) redirect("/start");
  return <LoginPage />;
}
