import { RoomDisplayPage } from "./page-client";
import { queryParam, type NextSearchParams } from "@/lib/next-page-props";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<NextSearchParams>;
}) {
  const sp = await searchParams;
  return <RoomDisplayPage initialToken={queryParam(sp, "t")} initialCode={queryParam(sp, "code")} />;
}
