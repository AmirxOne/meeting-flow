/**
 * پیشنهاد موضوعات جلسه با AI — دو مرحله‌ای (تحلیل → اعتبارسنجی)
 * الگو: Stage1 تحلیل/کاندید، Stage2 انتخاب نهایی ۵تایی، سپس
 * JSON Schema Check + Backend Validation + حداکثر ۲ Retry.
 */

import { llmChat, ensureAiAvailable } from "./llm-client.service";
import { prisma } from "@/server/db";

export interface SuggestedTopic {
  title: string;
}

const SYSTEM_PROMPT = `You are an AI assistant specialized in meeting agenda generation.

Your task is to analyze the provided meeting data and generate exactly 5 high-quality meeting topics.

IMPORTANT:
This process has TWO stages.
You MUST complete Stage 1 internally before generating the final output in Stage 2.

==================================================
STAGE 1 — ANALYZE AND EXTRACT CANDIDATE TOPICS
==================================================

Carefully analyze all provided meeting information, including:

- Meeting title
- Meeting description
- Meeting type
- Meeting participants
- User requests
- Priorities
- Deadlines
- Related project information
- Previous meeting information, if provided
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
- People
- Organizations
- Projects
- Numbers
- Dates
- Decisions
- Problems
- Requirements
- Events
- Facts

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
FINAL OUTPUT FORMAT
==================================================

Return ONLY valid JSON.

The response MUST follow exactly this structure:

{
  "topics": [
    "Topic 1",
    "Topic 2",
    "Topic 3",
    "Topic 4",
    "Topic 5"
  ]
}

Do not return Markdown.
Do not return code fences.
Do not return explanations.
Do not return any text before or after the JSON.`;

/** استخراج JSON از پاسخ — حتی اگر مدل fence گذاشته باشد */
export function extractJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** اعتبارسنجی سخت‌گیرانه‌ی خروجی — دقیقاً ۵، رشته، غیرخالی، غیرتکراری */
export function validateTopics(j: unknown): string[] | null {
  if (!j || typeof j !== "object") return null;
  const arr = (j as { topics?: unknown }).topics;
  if (!Array.isArray(arr) || arr.length !== 5) return null;
  const topics: string[] = [];
  for (const t of arr) {
    if (typeof t !== "string") return null;
    const clean = t.trim();
    if (!clean || clean.length > 200) return null;
    if (topics.some((x) => x === clean)) return null; // تکراری
    topics.push(clean);
  }
  return topics;
}

const MAX_RETRIES = 2;

export async function suggestAgendaTopics(meetingId: string): Promise<string[]> {
  await ensureAiAvailable();

  const m = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      participants: { include: { user: { select: { fullName: true, jobTitle: true } } } },
      agendaItems: { orderBy: { sortOrder: "asc" } },
      room: { select: { name: true } },
    },
  });
  if (!m) throw new Error("جلسه یافت نشد");

  const participants = m.participants
    .map((p) => `${p.user?.fullName ?? "?"}${p.user?.jobTitle ? ` (${p.user.jobTitle})` : ""}`)
    .join("، ");
  const previousAgenda = m.agendaItems.length
    ? m.agendaItems.map((it, i) => `${i + 1}. ${it.title}`).join("\n")
    : "";

  const userMsg = `MEETING DATA
==================================================

Meeting title:
${m.title}

Meeting description:
${m.description || ""}

Meeting priority:
${m.priority || ""}

Participants:
${participants}

User requests:
${m.participants.length} participant(s) confirmed/invited

Priorities:
${m.priority || ""}

Deadlines:
${m.startAt.toISOString()} — ${m.endAt.toISOString()}

Previous meeting information:
${previousAgenda || "None provided"}

Additional context:
Room: ${m.room?.name ?? "-"} · Status: ${m.status}`;

  let lastErr = "پاسخ نامعتبر";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let text: string;
    try {
      const r = await llmChat({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        temperature: 0.4,
        maxTokens: 1200,
        purpose: "agenda-topics",
      });
      text = r.text;
    } catch (e) {
      // خطای زیرساخت (پروایدر قطع و…) — retry بی‌فایده است
      throw new Error(`تولید موضوعات ناموفق: ${(e as Error).message}`.slice(0, 200));
    }
    const topics = validateTopics(extractJson(text));
    if (topics) return topics;
    lastErr = "خروجی مدل نامعتبر بود";
  }
  throw new Error(`${lastErr} پس از ${MAX_RETRIES + 1} تلاش`);
}
