import { describe, expect, it } from "vitest";
import { meetingsCsv, type MeetingRow } from "@/server/services/report.service";

describe("meetingsCsv", () => {
  it("writes a UTF-8 BOM and real newlines", () => {
    const rows: MeetingRow[] = [
      {
        id: "m1",
        title: 'جلسه "فروش"',
        status: "CONFIRMED",
        type: "INTERNAL",
        branch: "نیاوران",
        room: "اتاق آریا",
        organizer: "علی رضایی",
        participants: 2,
        guests: 0,
        startAt: new Date("2026-08-30T06:30:00.000Z"),
        endAt: new Date("2026-08-30T07:30:00.000Z"),
        durationMin: 60,
      },
    ];
    const csv = meetingsCsv(rows);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.replace(/^\uFEFF/, "").split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("id,title,status");
    expect(lines[1]).toContain("m1");
    expect(lines[1]).toContain('""فروش""');
    expect(csv).not.toContain("\\n");
  });
});
