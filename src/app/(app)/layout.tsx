import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { AppShell } from "@/components/layout/app-shell";
import { GuidedTours } from "@/components/guided-tours";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return <AppShell>{children}<GuidedTours /></AppShell>;
}
