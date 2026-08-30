import { NewMeetingPageContent } from "./page-client";
import type { NextSearchParams } from "@/lib/next-page-props";

export default async function NewMeetingPage({
  searchParams,
}: {
  searchParams: Promise<NextSearchParams>;
}) {
  return <NewMeetingPageContent searchParams={await searchParams} />;
}
