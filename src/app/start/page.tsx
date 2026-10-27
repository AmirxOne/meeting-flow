import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { platformNeedsSetup } from "@/server/services/platform-setup.service";
import { OrgSetupPage } from "./page-client";

// راه‌اندازی اولیه فقط برای کاربر لاگین‌شده — قبل از آن، ریدایرکت به لاگین.
export const dynamic = "force-dynamic";

export default async function StartPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/start");
  if (!(await platformNeedsSetup())) redirect("/dashboard");
  return <OrgSetupPage actorName={user.fullName} actorEmail={user.email} />;
}
