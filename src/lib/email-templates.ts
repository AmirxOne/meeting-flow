import { faNum } from "@/lib/fa";

export type EmailPayload = {
  subject: string;
  text: string;
  html: string;
};

export function appBaseUrl(env: NodeJS.Dict<string> = process.env): string {
  return (env.APP_URL ?? "http://localhost:3100").replace(/\/$/, "");
}

export function meetingAppUrl(meetingId: string, env: NodeJS.Dict<string> = process.env): string {
  return `${appBaseUrl(env)}/meetings/${meetingId}`;
}

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function brLines(text: string): string {
  return escapeHtml(text)
    .split("\n")
    .map((line) => (line.trim() ? line : "&nbsp;"))
    .join("<br/>");
}

export function wrapRtlEmailHtml(input: {
  heading: string;
  paragraphs: string[];
  cta?: { label: string; href: string };
}): string {
  const blocks = input.paragraphs
    .filter((p) => p.trim())
    .map(
      (p) =>
        `<tr><td style="padding:0 0 12px;font-size:14px;line-height:1.8;color:#3f3f46;">${brLines(p)}</td></tr>`,
    )
    .join("");
  const cta = input.cta
    ? `<tr><td style="padding:8px 0 0;">
        <a href="${escapeHtml(input.cta.href)}" style="display:inline-block;background:#0d0d0d;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:13px;">${escapeHtml(input.cta.label)}</a>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;background:#f4f4f5;font-family:Tahoma,Arial,sans-serif;" dir="rtl">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;padding:28px 24px;text-align:right;direction:rtl;">
        <tr><td style="padding:0 0 16px;font-size:12px;color:#71717a;">مهرسا</td></tr>
        <tr><td style="padding:0 0 16px;font-size:18px;font-weight:700;color:#0d0d0d;">${escapeHtml(input.heading)}</td></tr>
        ${blocks}
        ${cta}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function inviteEmailTemplate(input: {
  heading: string;
  when: string;
  videoLine?: string | null;
  meetingId?: string;
  appUrl?: string;
}): EmailPayload {
  const paragraphs = [input.when];
  if (input.videoLine?.trim()) paragraphs.push(input.videoLine.trim());
  const href = input.meetingId
    ? meetingAppUrl(input.meetingId, input.appUrl ? { APP_URL: input.appUrl } : process.env)
    : undefined;
  const textParts = [input.heading, "", input.when];
  if (input.videoLine?.trim()) textParts.push("", input.videoLine.trim());
  if (href) textParts.push("", href);
  return {
    subject: input.heading,
    text: textParts.join("\n"),
    html: wrapRtlEmailHtml({
      heading: input.heading,
      paragraphs,
      cta: href ? { label: "مشاهده جلسه", href } : undefined,
    }),
  };
}

export function reminderEmailTemplate(input: {
  title: string;
  agendaPlain?: string;
  offsetMin?: number;
  videoLine?: string | null;
  meetingId?: string;
  appUrl?: string;
}): EmailPayload {
  const subject = `یادآوری جلسه: ${input.title}`;
  const heading = `یادآوری جلسه «${input.title}»`;
  const offset =
    typeof input.offsetMin === "number" && input.offsetMin > 0
      ? `${faNum(input.offsetMin)} دقیقه دیگر آغاز می‌شود`
      : "جلسه در حال شروع است";
  const paragraphs = [offset];
  if (input.agendaPlain?.trim()) paragraphs.push(input.agendaPlain.trim());
  if (input.videoLine?.trim()) paragraphs.push(input.videoLine.trim());
  const href = input.meetingId
    ? meetingAppUrl(input.meetingId, input.appUrl ? { APP_URL: input.appUrl } : process.env)
    : undefined;
  const textParts = [heading, offset];
  if (input.agendaPlain?.trim()) textParts.push("", input.agendaPlain.trim());
  if (input.videoLine?.trim()) textParts.push("", input.videoLine.trim());
  if (href) textParts.push("", href);
  return {
    subject,
    text: textParts.join("\n"),
    html: wrapRtlEmailHtml({
      heading,
      paragraphs,
      cta: href ? { label: "مشاهده جلسه", href } : undefined,
    }),
  };
}

export function minutesEmailTemplate(input: {
  title: string;
  meetingId?: string;
  appUrl?: string;
}): EmailPayload {
  const heading = "صورتجلسه ثبت شد";
  const detail = `جلسه «${input.title}»`;
  const href = input.meetingId
    ? meetingAppUrl(input.meetingId, input.appUrl ? { APP_URL: input.appUrl } : process.env)
    : undefined;
  const textParts = [heading, detail];
  if (href) textParts.push("", href);
  return {
    subject: `صورتجلسه جلسه «${input.title}»`,
    text: textParts.join("\n"),
    html: wrapRtlEmailHtml({
      heading,
      paragraphs: [detail],
      cta: href ? { label: "مشاهده صورتجلسه", href } : undefined,
    }),
  };
}
