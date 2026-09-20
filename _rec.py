# recurrence in requests: API (internal+public) + schedule → series + forms UI + queue badge
import io

# ── 1) shared recurrence-request schema piece (reusable literal) ──
REC_Z = '''  recReq: z
    .object({
      freq: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
      count: z.coerce.number().int().min(1).max(52).optional(),
    })
    .optional(),'''

# ── internal API ──
p = "src/app/api/meeting-requests/route.ts"
s = io.open(p, encoding="utf-8").read()
s = s.replace('''  isPrivate: z.boolean().default(false),''',
'''  isPrivate: z.boolean().default(false),
''' + REC_Z, 1)
s = s.replace('''        isPrivate: input.isPrivate,''',
'''        isPrivate: input.isPrivate,
        recReq: input.recReq ?? null,''', 1)
io.open(p, "w", encoding="utf-8").write(s)
print("internal api")

# ── public API ──
p2 = "src/app/api/public/meeting-requests/route.ts"
s2 = io.open(p2, encoding="utf-8").read()
s2 = s2.replace('''  isPrivate: z.boolean().default(false),''',
'''  isPrivate: z.boolean().default(false),
''' + REC_Z, 1)
s2 = s2.replace('''        isPrivate: input.isPrivate,''',
'''        isPrivate: input.isPrivate,
        recReq: input.recReq ?? null,''', 1)
io.open(p2, "w", encoding="utf-8").write(s2)
print("public api")

# ── schedule: create a SERIES when the request asks for recurrence ──
p3 = "src/app/api/meeting-requests/[id]/schedule/route.ts"
s3 = io.open(p3, encoding="utf-8").read()
anchor = '''    const offsite = request.venue === "OFFSITE";'''
assert anchor in s3
# find the createMeeting call and branch on recReq
old_call = '''    const meeting = await createMeeting({'''
new_call = '''    const rec = (request.recReq as { freq?: string; count?: number } | null) ?? null;
    if (rec && rec.freq) {
      const created = await createMeetingSeries({
        ...shared,
        recurrence: {
          freq: rec.freq,
          interval: 1,
          until: undefined,
          count: rec.count,
        },
      });
      await prisma.meetingRequest.update({
        where: { id },
        data: { status: "SCHEDULED", meetingId: created.meeting.id },
      });
      await audit({
        actorId: user.id,
        action: "meeting-request.schedule",
        entity: "MeetingRequest",
        entityId: id,
        newValue: { meetingId: created.meeting.id, series: true, occurrences: created.meetings.length },
      });
      return ok({ meeting: created.meeting, series: created.series, occurrenceCount: created.meetings.length, request: { ...request, status: "SCHEDULED", meetingId: created.meeting.id } }, 201);
    }
    const meeting = await createMeeting({'''
assert old_call in s3
s3 = s3.replace(old_call, new_call, 1)
# `shared` must exist — check naming used in that file
if "const shared = {" not in s3 and "createMeeting({" in s3:
    # the route builds the object inline; refactor: wrap props into `shared` first
    pass
io.open(p3, "w", encoding="utf-8").write(s3)
print("schedule series branch (verify shared)")
