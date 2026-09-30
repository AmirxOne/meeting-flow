import { redirect } from "next/navigation";
import { NewMeetingPageContent } from "./page-client";
import { getSessionUser, can } from "@/server/auth/session";
import type { NextSearchParams } from "@/lib/next-page-props";

export default async function NewMeetingPage({
  searchParams,
}: {
  searchParams: Promise<NextSearchParams>;
}) {
  // کارمند مستقیم به فرم درخواست جلسه می‌رود — نه صفحه‌ی واسط
  const user = await getSessionUser();
  if (user && !can(user, "meeting:create")) redirect("/meeting-requests");
  return <NewMeetingPageContent searchParams={await searchParams} />;
}
