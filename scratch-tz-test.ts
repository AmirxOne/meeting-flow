import { validatePlan } from "./src/server/services/ai/smart-schedule-engine";

const c = {
  windowFrom: new Date("2026-10-10T00:00:00"),
  windowTo: new Date("2026-10-20T23:59:59"),
  workStartMin: 480,
  workEndMin: 1080,
  workDays: [6, 0, 1, 2, 3],
  holidaysIso: new Set<string>(),
  rooms: [],
  busy: [],
};
const v = validatePlan(
  [{ requestId: "r1", start: new Date("2026-10-13T06:00:00Z"), end: new Date("2026-10-13T07:00:00Z"), roomId: null }],
  c,
  [{ id: "r1", title: "x", urgency: "NORMAL", durationMin: 60, prefFrom: null, prefTo: null, prefSlots: null, participantIds: ["u1"], attendeeCount: null, venue: "OFFSITE" }],
);
console.log("validate:", JSON.stringify(v));
console.log("سرور getHours (06:00Z):", new Date("2026-10-13T06:00:00Z").getHours(), "| getDay:", new Date("2026-10-13T06:00:00Z").getDay());
