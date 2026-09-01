import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { platformNeedsSetup } from "@/server/services/platform-setup.service";
import { LandingPage } from "./page-client";

export default async function Page() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  if (await platformNeedsSetup()) redirect("/start");
  return <LandingPage />;
}
