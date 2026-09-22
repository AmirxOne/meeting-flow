import { PublicCheckinPage } from "./page-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ثبت‌حضور در جلسه — مهرسا",
  robots: { index: false },
};


export default function Page() {
  return <PublicCheckinPage />;
}
