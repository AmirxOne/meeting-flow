# week-view DnD + day-view empty-hour droppables
import io

# ── WEEK view: draggable chips + droppable hour cells ──
p = "src/app/(app)/calendar/page-client.tsx"
s = io.open(p, encoding="utf-8").read()

# 1) hour cells: Link → div droppable (keep new-meeting on double-click via button? keep Link inside)
old_cells = '''                      {Array.from({ length: WEEK_HOURS }, (_, i) => WEEK_START_HOUR + i).map((h) => (
                        <Link
                          key={h}
                          href={newMeetingHref(iso, h)}
                          aria-label={`جلسه جدید ${faPad2(h)}:۰۰`}
                          className="block h-12 border-b border-line/30 transition-colors hover:bg-paper-soft/80"
                        />
                      ))}'''
new_cells = '''                      {Array.from({ length: WEEK_HOURS }, (_, i) => WEEK_START_HOUR + i).map((h) => (
                        <div
                          key={h}
                          data-week-cell={`${iso}T${h}`}
                          onDragOver={(e) => { if (dragId) { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add("ring-2", "ring-inset", "ring-ink", "bg-paper-soft"); } }}
                          onDragLeave={(e) => { (e.currentTarget as HTMLElement).classList.remove("ring-2", "ring-inset", "ring-ink", "bg-paper-soft"); }}
                          onDrop={(e) => {
                            if (!dragId && !e.dataTransfer.getData("text/plain")) return;
                            e.preventDefault();
                            (e.currentTarget as HTMLElement).classList.remove("ring-2", "ring-inset", "ring-ink", "bg-paper-soft");
                            const id = e.dataTransfer.getData("text/plain") || dragId;
                            if (!id) return;
                            const m = (meetings ?? []).find((x) => x.id === id) ?? (dragInfo?.id === id ? dragInfo : undefined);
                            if (!m) return;
                            // keep the SAME hour; move to the target day
                            const src = new Date(new Date(m.startAt).getTime() + 210 * 60000);
                            const [y, mo, d] = iso.split("-").map(Number);
                            const newStart = new Date(Date.UTC(y, mo - 1, d, src.getUTCHours(), src.getUTCMinutes()));
                            const durMin = (new Date(m.endAt).getTime() - new Date(m.startAt).getTime()) / 60000;
                            setDragId(null);
                            setPendingDrop({ id, title: m.isMasked ? "جلسه محرمانه" : m.title, iso, newStart: new Date(newStart.getTime() - 210 * 60000), newEnd: new Date(newStart.getTime() - 210 * 60000 + durMin * 60000) });
                          }}
                          className="relative block h-12 border-b border-line/30 transition-colors hover:bg-paper-soft/80"
                        >
                          <Link href={newMeetingHref(iso, h)} aria-label={`جلسه جدید ${faPad2(h)}:۰۰`} className="absolute inset-0" />
                        </div>
                      ))}'''
assert old_cells in s, "week cells"
s = s.replace(old_cells, new_cells, 1)

# 2) week blocks: Link → draggable div (like month chips)
old_block = '''                      {blocks.map((b) => {
                        const m = dayMeetings.find((x) => x.id === b.id);
                        if (!m) return null;
                        return (
                          <Link
                            key={m.id}
                            href={`/meetings/${m.id}`}
                            className={cn(
                              "absolute z-10 overflow-hidden rounded px-1.5 py-1 text-[10px] leading-tight transition-opacity hover:opacity-90",
                              calendarEventTone(m.status).block,
                            )}}'''
new_block = '''                      {blocks.map((b) => {
                        const m = dayMeetings.find((x) => x.id === b.id);
                        if (!m) return null;
                        return (
                          <div
                            key={m.id}
                            role="link"
                            tabIndex={0}
                            data-mid={m.id}
                            onClick={() => router.push(`/meetings/${m.id}`)}
                            onKeyDown={(e) => { if (e.key === "Enter") router.push(`/meetings/${m.id}`); }}
                            draggable={canDnD && !m.isMasked ? true : undefined}
                            onDragStart={(e) => {
                              setDragId(m.id);
                              setDragInfo({ id: m.id, title: m.title, startAt: m.startAt, endAt: m.endAt, isMasked: m.isMasked });
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", m.id);
                            }}
                            onDragEnd={() => { setDragId(null); setDragOverIso(null); setDragInfo(null); stopAutoAdvance(); }}
                            className={cn(
                              "absolute z-10 cursor-pointer overflow-hidden rounded px-1.5 py-1 text-[10px] leading-tight transition-opacity hover:opacity-90",
                              calendarEventTone(m.status).block,
                              canDnD && !m.isMasked && "cursor-grab active:cursor-grabbing",
                              dragId === m.id && "opacity-40",
                            )}}'''
assert old_block in s, "week blocks"
s = s.replace(old_block, new_block, 1)

# close tag of the block: </Link> → </div> (the one right after the block content)
old_close = '''                            {m.room && b.height > 36 && <p className="truncate opacity-70">{m.room.name}</p>}
                          </Link>'''
new_close = '''                            {m.room && b.height > 36 && <p className="truncate opacity-70">{m.room.name}</p>}
                          </div>'''
assert old_close in s, "block close"
s = s.replace(old_close, new_close, 1)

io.open(p, "w", encoding="utf-8").write(s)
print("week DnD done")

# ── DAY view: empty hours droppable too ──
p2 = "src/components/calendar/day-timeline.tsx"
s2 = io.open(p2, encoding="utf-8").read()
# after the occupied groups, append a droppable "ساعت خالی" row of hour chips 8..20
old2 = '''        </CardBody>
      </Card>'''
# find the LAST occurrence inside DayTimeline render — target the one after groups map: search for a unique anchor near the end of the component
anchor = "dragOverHour === group.hour"
assert anchor in s2
# insert an empty-hours strip right before the closing of the day column: find the wrapper after groups
# simplest: add after the groups map container — anchor on the CardBody closing within DayTimeline:
idx = s2.rindex(old2)
new2 = '''        {onReschedule && (
          <div className="mt-4 rounded-lg border border-dashed border-line p-3">
            <p className="mb-2 text-[11px] font-medium text-ink-faint">انتقال به ساعت خالی — جلسه را روی ساعت دلخواه رها کنید</p>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-13">
              {Array.from({ length: 13 }, (_, i) => 8 + i).map((h) => (
                <div
                  key={h}
                  data-empty-hour={h}
                  onDragOver={(e) => { if (!dragId) return; e.preventDefault(); setDragOverHour(h); }}
                  onDragLeave={() => setDragOverHour((x) => (x === h ? null : x))}
                  onDrop={(e) => {
                    if (!onReschedule) return;
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain") || dragId;
                    setDragId(null);
                    setDragOverHour(null);
                    if (id) onReschedule(id, h);
                  }}
                  className={cn(
                    "flex h-9 cursor-pointer items-center justify-center rounded-md border text-[11.5px] font-medium tabular-nums transition-colors",
                    dragOverHour === h ? "border-ink bg-paper-soft ring-2 ring-inset ring-ink" : "border-line bg-white text-ink-soft hover:bg-paper-soft",
                  )}
                >
                  {faPad2(h)}:۰۰
                </div>
              ))}
            </div>
          </div>
        )}
        </CardBody>
      </Card>'''
s2 = s2[:idx] + new2 + s2[idx + len(old2):]
io.open(p2, "w", encoding="utf-8").write(s2)
print("day empty-hours done")
