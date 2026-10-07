/**
 * فیچر: پیشنهاد ۵ موضوع دستور جلسه — دو مرحله‌ای
 * (تحلیل کاندیداها → اعتبارسنجی → دقیقاً ۵ موضوع)
 */

import type { AiFeature } from "../feature-base";
import { extractJson } from "../feature-base";
import type { MeetingAiContext } from "../context.service";

const SYSTEM_PROMPT = `You are an AI assistant specialized in meeting agenda generation.

Your task is to analyze the provided meeting data and generate exactly 5 high-quality meeting topics.

IMPORTANT:
This process has TWO stages.
You MUST complete Stage 1 internally before generating the final output in Stage 2.

==================================================
STAGE 1 — ANALYZE AND EXTRACT CANDIDATE TOPICS
==================================================

Carefully analyze all provided meeting information, including:

- Meeting title, description, type, priority
- Meeting participants (names and job titles) and guests
- Organizer info
- Room and branch context
- Existing agenda items, if any
- Previous meeting information (same series), if provided
- Previous decisions and their status
- Meeting form data (goals, flow, questions, progress)
- Attachments metadata
- Any other relevant contextual information

From this information, identify the most important and relevant subjects that could reasonably be discussed during the meeting.

For each candidate topic, consider:

1. Relevance to the meeting purpose
2. Importance
3. Whether it is supported by the provided data
4. Whether it can lead to a meaningful discussion
5. Whether it can lead to a decision, action, review, or follow-up
6. Whether it duplicates another candidate
7. Whether it is sufficiently specific

DO NOT invent:
- People, Organizations, Projects, Numbers, Dates, Decisions, Problems, Requirements, Events, Facts

that are not supported by the provided meeting data.

Do not create a topic merely because the system requires 5 topics.

If several pieces of information represent the same subject, combine them into one stronger topic.

Prioritize concrete and meaningful subjects over generic topics.

Avoid generic topics such as:

- General project discussion
- General review
- Other matters
- Open discussion
- Miscellaneous
- Meeting introduction

unless the provided meeting data explicitly requires such a topic.

If previous meeting decisions have OPEN or PENDING status, strongly consider a follow-up topic for them.

==================================================
STAGE 2 — VALIDATE AND GENERATE FINAL TOPICS
==================================================

Before returning the final answer, review all candidate topics from Stage 1.

For every candidate topic, verify:

1. Is it directly relevant to the meeting?
2. Is it supported by the provided information?
3. Is it meaningful enough to discuss during the meeting?
4. Is it specific enough?
5. Is it duplicated or substantially similar to another topic?
6. Does it contain any unsupported assumptions or invented information?
7. Is it more useful than the other candidates?

Remove candidates that fail these checks.
Merge candidates that are substantially similar.
Then select the 5 strongest and most relevant topics.

IMPORTANT RULES FOR THE FINAL 5 TOPICS:

- Return EXACTLY 5 topics.
- Return no fewer than 5 topics.
- Return no more than 5 topics.
- Each topic must be a non-empty string.
- Each topic must be directly related to the meeting.
- Topics must not be duplicates or near-duplicates.
- Topics should be concise and specific.
- Topics should be suitable for use directly as meeting agenda items.
- Order topics from highest importance/relevance to lowest importance/relevance.
- Do not add explanations.
- Do not add recommendations outside the topics.
- Do not add assumptions.
- Do not invent missing information.

If the available information is limited, use only reasonable conclusions supported by the provided data. Never fabricate facts just to fill the required 5 topics.

Write the topics in the same language as the meeting data (Persian meeting → Persian topics).

==================================================
TIME BUDGET — CRITICAL
==================================================

The meeting starts at {{MEETING_START}} and ends at {{MEETING_END}} (total {{MEETING_DURATION}} minutes).

Each of the 5 topics MUST include a proposed start and end time (HH:MM, 24-hour format):

- Topic times must stay WITHIN the meeting window. Never schedule anything before the meeting start or after the meeting end.
- Topics must be chronological and non-overlapping: topic 1 ends when topic 2 starts (or there may be small gaps).
- The sum of topic durations must NOT exceed the total meeting duration.
- Leave reasonable time uncovered if the meeting is long (do NOT stretch topics to fill the entire meeting).
- Order topics by importance; allocate more time to the most important ones.

==================================================
FINAL OUTPUT FORMAT
==================================================

Return ONLY valid JSON.

The response MUST follow exactly this structure:

{
  "topics": [
    { "title": "Topic 1", "start": "HH:MM", "end": "HH:MM" },
    { "title": "Topic 2", "start": "HH:MM", "end": "HH:MM" },
    { "title": "Topic 3", "start": "HH:MM", "end": "HH:MM" },
    { "title": "Topic 4", "start": "HH:MM", "end": "HH:MM" },
    { "title": "Topic 5", "start": "HH:MM", "end": "HH:MM" }
  ]
}

Do not return Markdown.
Do not return code fences.
Do not return explanations.
Do not return any text before or after the JSON.`;

/** رندر کامل context به بلوک متنی داده‌ی جلسه */
function renderContext(c: MeetingAiContext): string {
  const L: string[] = [];
  L.push(`Meeting title:\n${c.meeting.title}`);
  L.push(`Meeting description:\n${c.meeting.description || ""}`);
  L.push(`Meeting type:\n${c.meeting.meetingType}`);
  L.push(`Priority:\n${c.meeting.priority}`);
  L.push(`Status:\n${c.meeting.status}`);
  L.push(`Date & duration:\n${c.meeting.startAt.toISOString()} — ${c.meeting.endAt.toISOString()} (${c.meeting.durationMin} minutes)`);
  L.push(`Recurring:\n${c.meeting.isRecurring ? "yes" : "no"}`);
  L.push(`Location:\n${[c.branch?.name, c.room ? `${c.room.name} (capacity ${c.room.capacity ?? "?"})` : null].filter(Boolean).join(" / ") || "-"}`);
  if (c.organizer) {
    L.push(`Organizer:\n${c.organizer.name}${c.organizer.jobTitle ? ` (${c.organizer.jobTitle})` : ""}`);
  }
  L.push(`Participants:\n${c.participants.map((p) => `- ${p.name}${p.jobTitle ? ` (${p.jobTitle})` : ""}${p.isOrganizer ? " [organizer]" : ""}${p.responseStatus ? ` [rsvp: ${p.responseStatus}]` : ""}`).join("\n") || "none"}`);
  if (c.guests.length) {
    L.push(`External guests:\n${c.guests.map((g) => `- ${g.name}${g.company ? ` (${g.company})` : ""}`).join("\n")}`);
  }
  if (c.secretaries.length) {
    L.push(`Secretaries:\n${c.secretaries.map((s) => s.name).join("، ")}`);
  }
  L.push(`Existing agenda items:\n${c.agendaItems.map((a) => `- ${a.title}${a.durationMin ? ` (${a.durationMin}min)` : ""}${a.owner ? ` — owner: ${a.owner}` : ""}`).join("\n") || "none"}`);
  if (c.previousInSeries) {
    L.push(`Previous meeting in series:\n${c.previousInSeries.title} (${c.previousInSeries.startAt.toISOString()})`);
    if (c.previousInSeries.topics.length) {
      L.push(`Previous topics:\n${c.previousInSeries.topics.map((t) => `- ${t}`).join("\n")}`);
    }
    if (c.previousInSeries.decisions.length) {
      L.push(`Previous decisions:\n${c.previousInSeries.decisions.map((d) => `- ${d}`).join("\n")}`);
    }
  }
  if (c.decisions.length) {
    L.push(`Current decisions on record:\n${c.decisions.map((d) => `- ${d.text}${d.owner ? ` — ${d.owner}` : ""}`).join("\n")}`);
  }
  if (c.topics.length) {
    L.push(`Recorded topics:\n${c.topics.map((t) => `- ${t.title} [${t.reviewStatus}]${t.actions ? ` — actions: ${t.actions}` : ""}`).join("\n")}`);
  }
  if (c.docTemplate?.goals) {
    L.push(`Meeting goals (from form):\n${c.docTemplate.goals}`);
  }
  if (c.docTemplate?.progress?.length) {
    L.push(`Progress of previous resolutions (from form):\n${c.docTemplate.progress.map((p) => `- ${p.decision} — ${p.owner}${p.due ? ` (due ${p.due})` : ""}${p.status ? ` [${p.status}]` : ""}`).join("\n")}`);
  }
  if (c.docTemplate?.questions?.some((q) => q.title.trim())) {
    L.push(`Open questions from attendees (from form):\n${c.docTemplate.questions.filter((q) => q.title.trim()).map((q) => `- ${q.title}${q.asker ? ` — ${q.asker}` : ""}`).join("\n")}`);
  }
  if (c.attachments.length) {
    L.push(`Attachments:\n${c.attachments.map((a) => `- ${a.name} (${a.kind}, ${a.mimeType})`).join("\n")}`);
  }
  if (c.minutes?.summary) {
    L.push(`Existing minutes summary:\n${c.minutes.summary.slice(0, 800)}`);
  }
  return L.join("\n\n");
}

/** خروجی فیچر: موضوع + بازه‌ی زمانی پیشنهادی */
export interface SuggestedTopicSlot {
  title: string;
  start: string;
  end: string;
}

function fmtHM(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function parseHM(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * اعتبارسنجی سخت‌گیرانه:
 * دقیقاً ۵ · رشته · غیرخالی · غیرتکراری · فرمت HH:MM ·
 * داخل بازه‌ی جلسه · chronological بدون هم‌پوشانی ·
 * مجموع مدت ≤ کل جلسه (۲٪ تلورانس گرد شدن).
 */
export function validateTopicsOutput(
  raw: string,
  ctx?: { meeting: { startAt: Date; endAt: Date; durationMin: number } } | { startAt: Date; endAt: Date; durationMin: number },
): SuggestedTopicSlot[] | null {
  const j = extractJson(raw);
  if (!j || typeof j !== "object") return null;
  const arr = (j as { topics?: unknown }).topics;
  if (!Array.isArray(arr) || arr.length !== 5) return null;

  const titles: string[] = [];
  const out: SuggestedTopicSlot[] = [];
  for (const t of arr) {
    if (!t || typeof t !== "object") return null;
    const title = (t as { title?: unknown }).title;
    if (typeof title !== "string") return null;
    const clean = title.trim();
    if (!clean || clean.length > 200) return null;
    if (titles.some((x) => x === clean)) return null;
    titles.push(clean);

    const start = (t as { start?: unknown }).start;
    const end = (t as { end?: unknown }).end;
    if (typeof start !== "string" || typeof end !== "string") return null;
    const s = parseHM(start);
    const e = parseHM(end);
    if (s === null || e === null || e <= s) return null;
    out.push({ title: clean, start: start.trim(), end: end.trim() });
  }

  // چک‌های زمانی — فقط وقتی ctx داده شده (پروداکشن؛ تست‌های قدیمی بدون ctx هم پاس شوند)
  const m2 = ctx && "meeting" in ctx ? ctx.meeting : ctx;
  if (m2) {
    const winS = m2.startAt.getHours() * 60 + m2.startAt.getMinutes();
    const winE = m2.endAt.getHours() * 60 + m2.endAt.getMinutes();
    let total = 0;
    let prevEnd = -1;
    for (const t of out) {
      const s = parseHM(t.start)!;
      const e = parseHM(t.end)!;
      // داخل بازه‌ی جلسه
      if (s < winS || e > winE) return null;
      // بدون هم‌پوشانی و صعودی
      if (prevEnd !== -1 && s < prevEnd) return null;
      prevEnd = e;
      total += e - s;
    }
    // مجموع مدت نباید از جلسه بیشتر شود (تلورانس ۲٪)
    if (total > m2.durationMin * 1.02) return null;
  }
  return out;
}

export const agendaTopicsFeature: AiFeature<SuggestedTopicSlot[]> = {
  id: "agenda-topics",
  temperature: 0.4,
  maxTokens: 3000,
  maxRetries: 2,
  buildPrompt: (ctx) => [
    {
      role: "system",
      content: SYSTEM_PROMPT
        .replace("{{MEETING_START}}", fmtHM(ctx.meeting.startAt))
        .replace("{{MEETING_END}}", fmtHM(ctx.meeting.endAt))
        .replace("{{MEETING_DURATION}}", String(ctx.meeting.durationMin)),
    },
    {
      role: "user",
      content: `MEETING DATA\n==================================================\n\n${renderContext(ctx)}`,
    },
  ],
  validate: validateTopicsOutput,
};
