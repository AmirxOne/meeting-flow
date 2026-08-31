import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { LandingPage } from "./page-client";

export default async function Page() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  return <LandingPage />;
}
