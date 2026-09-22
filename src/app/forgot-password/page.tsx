import { redirect } from "next/navigation";

/** The forgot-password flow now lives INSIDE /login — permanent redirect. */
export default function Page() {
  redirect("/login");
}
