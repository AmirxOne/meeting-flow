"use client";

/**
 * Admin entry for the people directory.
 *
 * Architecture: reuses PeopleDirectoryPage (same as /people) instead of redirect.
 * Redirect was rejected because /people is open to all employees while this route
 * stays inside the admin panel and is gated behind user:update.
 */
import { PeopleDirectoryPage } from "@/components/people/people-directory-page";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-store";

export function AdminPeoplePage() {
  const { can } = useAuth();

  if (!can("user:update")) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center text-[13px] text-ink-soft">
          مدیریت دایرکتوری افراد نیازمند دسترسی مدیریت کاربران (user:update) است.
        </Card>
      </div>
    );
  }

  return <PeopleDirectoryPage variant="admin" />;
}
