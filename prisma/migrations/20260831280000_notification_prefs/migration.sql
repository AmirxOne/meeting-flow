-- Per-user notification channel preferences (invite / reminder / reschedule)

ALTER TABLE "User" ADD COLUMN "notificationPrefs" JSONB;
