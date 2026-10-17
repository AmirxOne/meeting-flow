import { redirect } from "next/navigation";

/** ادغام شد — همه‌چیز در /appointments (تب «برنامه‌های من») */
export default function Page() {
  redirect("/appointments");
}
